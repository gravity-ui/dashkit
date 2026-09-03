import React from 'react';

import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import type {DashKitProps} from '../components/DashKit';
import {
    COMPACT_TYPE_HORIZONTAL_NOWRAP,
    DEFAULT_GROUP,
    DEFAULT_WIDGET_HEIGHT,
    DEFAULT_WIDGET_WIDTH,
    TEMPORARY_ITEM_ID,
} from '../constants/common';
import {DashKitContext, DashKitDnDContext, DashkitOverlayControlsContext} from '../context';
import type {
    DashKitCtxShape,
    DashkitPropsPassedToCtx,
    OverlayControlsCtxShape,
    TemporaryLayout,
} from '../context';
import {useDeepEqualMemo} from '../hooks/useDeepEqualMemo';
import type {ConfigLayout} from '../shared';
import {CONFIG_LAYOUT_FIELDS, getAllConfigItems, getItemsParams, getItemsState} from '../shared';
import type {DashKitEventMap, DashKitEventName, PluginRef} from '../typings';
import type {RegisterManager, RegisterManagerPlugin} from '../utils';
import {
    UpdateManager,
    convertEnrichedLayoutToConfigLayout,
    emitDashKitChangeEvent,
    enrichLayoutWithDefaults,
    resolveLayoutGroup,
} from '../utils';

export type DashKitWithContextProps = DashkitPropsPassedToCtx &
    Pick<
        DashKitProps,
        'overlayControls' | 'overlayMenuItems' | 'getPreparedCopyItemOptions' | 'onCopyFulfill'
    > &
    Required<
        Pick<
            DashKitProps,
            | 'itemsStateAndParams'
            | 'defaultGlobalParams'
            | 'globalParams'
            | 'context'
            | 'settings'
            | 'onItemEdit'
            | 'onChange'
            | 'onDrop'
        >
    > & {
        registerManager: RegisterManager;
        forwardedMetaRef: React.ForwardedRef<any>;
        emitDashKitEvent: <T extends DashKitEventName>(
            eventName: T,
            event: DashKitEventMap[T],
        ) => void;
    };

type OriginalLayouts = Record<string, ConfigLayout>;

type AdjustedLayouts = Record<string, ConfigLayout>;

type NowrapAdjustedLayouts = Record<string, number>;

type PendingExternalBaselineLayout = {
    layout: ConfigLayout[];
    previousBaselineLayout: ConfigLayout[];
};

type UseMemoStateContextResult = {
    dashkitContextValue: DashKitCtxShape;
    controlsContextValue: OverlayControlsCtxShape;
};

const hasGetMeta = (value: PluginRef): value is {getMeta: () => Promise<any>} => {
    return (
        typeof value === 'object' &&
        value !== null &&
        'getMeta' in value &&
        typeof value.getMeta === 'function'
    );
};

const hasReload = (
    value: PluginRef,
): value is {reload: (data: {silentLoading: boolean; noVeil: boolean}) => void} => {
    return (
        typeof value === 'object' &&
        value !== null &&
        'reload' in value &&
        typeof value.reload === 'function'
    );
};

function useMemoStateContext(props: DashKitWithContextProps): UseMemoStateContextResult {
    // Since we don't want to store widget parameters with auto-height enabled in the store or server,
    // the actual layout (visible to the user at any moment) will be stored in state.
    // However, to ensure the store gets the layout without considering auto-height widgets,
    // when a widget's height is adjusted, the original h (height) value is saved in originalLayouts,
    // and the new adjusted height is stored in adjustedLayouts.

    const originalLayouts = React.useRef<OriginalLayouts>({});
    const adjustedLayouts = React.useRef<AdjustedLayouts>({});
    const nowrapAdjustedLayouts = React.useRef<NowrapAdjustedLayouts>({});

    // Enrich layout with default values from plugins.
    // This ensures backward compatibility: if props.layout is already enriched (old flow),
    // enrichLayoutWithDefaults will just merge and return similar result.
    // If props.layout comes directly from config (new flow), it gets properly enriched.
    const enrichedPropsLayout = React.useMemo(
        () => enrichLayoutWithDefaults(props.config, props.registerManager),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [props.config.layout, props.registerManager],
    );

    const internalBaselineLayoutRef = React.useRef<ConfigLayout[]>(enrichedPropsLayout);
    const [visualLayout, setVisualLayout] = React.useState<ConfigLayout[]>(enrichedPropsLayout);
    const [previousEnrichedPropsLayout, setPreviousEnrichedPropsLayout] =
        React.useState(enrichedPropsLayout);
    const [pendingExternalBaselineLayout, setPendingExternalBaselineLayout] =
        React.useState<PendingExternalBaselineLayout>();
    const getBaselineLayout = React.useCallback(() => {
        if (
            pendingExternalBaselineLayout &&
            internalBaselineLayoutRef.current ===
                pendingExternalBaselineLayout.previousBaselineLayout
        ) {
            return pendingExternalBaselineLayout.layout;
        }

        return internalBaselineLayoutRef.current;
    }, [pendingExternalBaselineLayout]);

    const [externalLayoutRevision, setExternalLayoutRevision] = React.useState(0);
    const [temporaryLayout, setTemporaryLayout] = React.useState<TemporaryLayout | null>(null);
    const resetTemporaryLayout = React.useCallback(
        () => setTemporaryLayout(null),
        [setTemporaryLayout],
    );

    const dndContext = React.useContext(DashKitDnDContext);
    const outerDnDEnable = Boolean(dndContext);

    // TODO: need move originalLayouts, adjustedLayouts to state
    const [layoutUpdateCounter, forceUpdateLayout] = React.useState(0);

    const onChange = React.useCallback(
        ({
            config = props.config,
            itemsStateAndParams = props.itemsStateAndParams,
            groups = props.groups,
        }) => {
            if (
                !(
                    isEqual(config, props.config) &&
                    isEqual(itemsStateAndParams, props.itemsStateAndParams) &&
                    isEqual(groups, props.groups)
                )
            ) {
                props.onChange({config, itemsStateAndParams, groups});
            }
        },
        [props.config, props.groups, props.itemsStateAndParams, props.onChange],
    );

    // Callback invoked when grid layout changes. The first argument is the actual layout config,
    // which includes adjusted "h" values for items with auto-height enabled. To ensure that
    // values stored are not adjusted (as if auto-height was disabled), we correct them using
    // the originalLayouts stored without adjustments.
    const onLayoutChange = React.useCallback(
        (layout: ConfigLayout[]) => {
            const currentInnerLayout = layout.map((item) => {
                if (item.i in originalLayouts.current) {
                    const {parent: _parent, ...originalCopy} = originalLayouts.current[item.i];

                    if (item.parent) {
                        (originalCopy as ConfigLayout).parent = item.parent;
                    }
                    originalCopy.w = item.w;
                    originalCopy.x = item.x;
                    originalCopy.y = item.y;

                    return originalCopy satisfies ConfigLayout;
                } else {
                    return {...item};
                }
            });

            const baselineConfig = {
                ...props.config,
                layout: getBaselineLayout(),
            };

            const newConfig = UpdateManager.updateLayout({
                layout: currentInnerLayout,
                config: baselineConfig,
            });

            emitDashKitChangeEvent({
                config: baselineConfig,
                newConfig,
                onChange,
                emitDashKitEvent: props.emitDashKitEvent,
            });

            internalBaselineLayoutRef.current = newConfig.layout;
        },
        [getBaselineLayout, props.config, props.emitDashKitEvent, onChange],
    );

    const getLayoutItem = React.useCallback(
        (id: string) => {
            return getBaselineLayout().find(({i}) => i === id);
        },
        [getBaselineLayout],
    );

    const getOuterLayout = React.useCallback((): ConfigLayout[] => {
        return convertEnrichedLayoutToConfigLayout(getBaselineLayout());
    }, [getBaselineLayout]);

    // to calculate items, only memorization of items and globalItems is important
    const configItems = React.useMemo(
        () => getAllConfigItems(props.config),
        [props.config.items, props.config.globalItems],
    );

    const onItemRemove = React.useCallback(
        (id: string) => {
            delete nowrapAdjustedLayouts.current[id];
            delete adjustedLayouts.current[id];
            delete originalLayouts.current[id];

            if (id === TEMPORARY_ITEM_ID) {
                resetTemporaryLayout();
            } else {
                if (temporaryLayout) {
                    setTemporaryLayout({
                        ...temporaryLayout,
                        data: temporaryLayout.data.filter(({i}) => i !== id),
                    });
                }

                onChange(
                    UpdateManager.removeItem({
                        id,
                        config: {...props.config, layout: getOuterLayout()},
                        itemsStateAndParams: props.itemsStateAndParams,
                    }),
                );
            }
        },
        [
            resetTemporaryLayout,
            temporaryLayout,
            onChange,
            props.config,
            props.itemsStateAndParams,
            getOuterLayout,
        ],
    );

    const onItemStateAndParamsChange = React.useCallback<
        DashKitCtxShape['onItemStateAndParamsChange']
    >(
        (id, stateAndParams, options) => {
            const currentConfig = {...props.config, layout: getOuterLayout()};
            onChange({
                config: currentConfig,
                // config is not strictly required here; ideally it should be removed along with the default props
                itemsStateAndParams: UpdateManager.changeStateAndParams({
                    id,
                    config: currentConfig,
                    stateAndParams,
                    itemsStateAndParams: props.itemsStateAndParams,
                    options,
                }),
            });
        },
        [props.config, props.itemsStateAndParams, getOuterLayout, onChange],
    );

    const memorizeOriginalLayout = React.useCallback<DashKitCtxShape['memorizeOriginalLayout']>(
        (widgetId, preAutoHeightLayout, postAutoHeightLayout) => {
            let needUpdateLayout = false;
            if (!(widgetId in originalLayouts.current)) {
                originalLayouts.current[widgetId] = preAutoHeightLayout;
                needUpdateLayout = true;
            }
            if (adjustedLayouts.current[widgetId] !== postAutoHeightLayout) {
                adjustedLayouts.current[widgetId] = postAutoHeightLayout;
                needUpdateLayout = true;
            }

            if (needUpdateLayout) {
                forceUpdateLayout((prev) => prev + 1);
            }
        },
        [],
    );

    const revertToOriginalLayout = React.useCallback((widgetId: string) => {
        const needUpdateLayout =
            widgetId in adjustedLayouts.current || widgetId in originalLayouts.current;
        delete adjustedLayouts.current[widgetId];
        delete originalLayouts.current[widgetId];
        if (needUpdateLayout) {
            forceUpdateLayout((prev) => prev + 1);
        }
    }, []);

    React.useMemo(() => {
        const groups = props.groups;
        // Use visualLayout instead of props.layout (which is now optional)
        const layout = visualLayout;
        const defaultProps = props.registerManager.gridLayout || {};
        const nowrapGroups: Record<string, {items: ConfigLayout[]; leftSpace: number}> = {};
        let hasNowrapGroups = false;

        if (
            defaultProps.compactType === COMPACT_TYPE_HORIZONTAL_NOWRAP &&
            defaultProps.cols !== undefined
        ) {
            nowrapGroups[DEFAULT_GROUP] = {
                items: [],
                leftSpace: defaultProps.cols,
            };
            hasNowrapGroups = true;
        }

        if (groups) {
            groups.forEach((group) => {
                const resultProps = group.gridProperties?.(defaultProps) || {};

                if (
                    resultProps.compactType === COMPACT_TYPE_HORIZONTAL_NOWRAP &&
                    resultProps.cols !== undefined &&
                    group.id
                ) {
                    nowrapGroups[group.id] = {
                        items: [],
                        leftSpace: resultProps.cols,
                    };
                    hasNowrapGroups = true;
                }
            });
        }

        if (hasNowrapGroups) {
            layout.forEach((item) => {
                const widgetId = item.i;
                const parentId = resolveLayoutGroup(item);

                if (nowrapGroups[parentId]) {
                    // Collecting nowrap elements
                    nowrapGroups[parentId].items.push(item);
                    nowrapGroups[parentId].leftSpace -= item.w;
                } else if (nowrapAdjustedLayouts.current[widgetId]) {
                    // If element is not in horizontal-nowrap cleaning up and reverting adjustLayout values
                    delete nowrapAdjustedLayouts.current[widgetId];
                }
            });

            Object.entries(nowrapGroups).forEach(([, {items, leftSpace}]) => {
                items.forEach((item) => {
                    // setting maxW with adjustLayout fields and saving previous
                    nowrapAdjustedLayouts.current[item.i] = item.w + leftSpace;
                });
            });
        }
    }, [props.registerManager, props.groups, visualLayout]);

    // Synchronize visual layout during render, so children never see new config with old layout.
    // Keep the previous external layout separate from the drag baseline: a drag updates the latter.
    if (previousEnrichedPropsLayout !== enrichedPropsLayout) {
        setPreviousEnrichedPropsLayout(enrichedPropsLayout);

        if (!isEqual(internalBaselineLayoutRef.current, enrichedPropsLayout)) {
            setPendingExternalBaselineLayout({
                layout: enrichedPropsLayout,
                previousBaselineLayout: internalBaselineLayoutRef.current,
            });
            setVisualLayout(enrichedPropsLayout);
            setExternalLayoutRevision((r) => r + 1);
        }
    }

    React.useLayoutEffect(() => {
        if (pendingExternalBaselineLayout) {
            if (
                internalBaselineLayoutRef.current ===
                pendingExternalBaselineLayout.previousBaselineLayout
            ) {
                internalBaselineLayoutRef.current = pendingExternalBaselineLayout.layout;
            }
            setPendingExternalBaselineLayout(undefined);
        }
    }, [pendingExternalBaselineLayout]);

    const itemsParams = useDeepEqualMemo(
        () =>
            getItemsParams({
                defaultGlobalParams: props.defaultGlobalParams,
                globalParams: props.globalParams,
                config: props.config,
                itemsStateAndParams: props.itemsStateAndParams,
                plugins: props.registerManager.getPlugins(),
            }),
        [
            props.defaultGlobalParams,
            props.globalParams,
            props.config,
            props.itemsStateAndParams,
            props.registerManager,
        ],
    );

    const itemsState = useDeepEqualMemo(
        () =>
            getItemsState({
                config: props.config,
                itemsStateAndParams: props.itemsStateAndParams,
            }),
        [props.config, props.itemsStateAndParams],
    );

    const getItemsMeta = React.useCallback<DashKitCtxShape['getItemsMeta']>((pluginsRefs) => {
        return pluginsRefs
            .map((ref) => {
                if (!(ref && hasGetMeta(ref))) {
                    return undefined;
                }
                return ref.getMeta();
            })
            .filter((item): item is Promise<any> => item !== undefined);
    }, []);

    const resultLayout = React.useMemo(() => {
        const adjusted = adjustedLayouts.current;
        const original = originalLayouts.current;
        const nowrapAdjust = nowrapAdjustedLayouts.current;

        return visualLayout.map((item) => {
            const widgetId = item.i;

            if (widgetId in adjusted || widgetId in nowrapAdjust) {
                original[widgetId] = item;
                // eslint-disable-next-line no-unused-vars
                const {parent: _parent2, ...adjustedItem} = adjusted[widgetId] || item;

                adjustedItem.w = item.w;
                adjustedItem.x = item.x;
                adjustedItem.y = item.y;

                if (item.parent) {
                    (adjustedItem as ConfigLayout).parent = item.parent;
                }

                if (widgetId in nowrapAdjust) {
                    (adjustedItem as ConfigLayout & {maxW?: number}).maxW = nowrapAdjust[widgetId];
                }

                return adjustedItem satisfies ConfigLayout;
            } else {
                if (widgetId in original) {
                    delete original[widgetId];
                }
                return item;
            }
        });
    }, [visualLayout, layoutUpdateCounter]);

    const reloadItems = React.useCallback<DashKitCtxShape['reloadItems']>((pluginsRefs, data) => {
        pluginsRefs.forEach((ref) => ref && hasReload(ref) && ref.reload(data));
    }, []);

    const dragPropsContext = dndContext?.dragProps;
    const onDropDragOverContext = dndContext?.onDropDragOver;

    const dragOverPlugin = React.useMemo(() => {
        if (!dragPropsContext) {
            return null;
        }

        const pluginType = dragPropsContext.type;

        if (props.registerManager.check(pluginType)) {
            return props.registerManager.getItem(pluginType);
        } else {
            // eslint-disable-next-line no-console
            console.error(`Uknown pluginType: ${pluginType}`);
            return null;
        }
    }, [dragPropsContext, props.registerManager]);

    const onDropDragOver = React.useCallback<DashKitCtxShape['onDropDragOver']>(
        (_e, group, gridProps, groupLayout, sharedItem) => {
            if (temporaryLayout) {
                resetTemporaryLayout();
                return false;
            }

            let dragItemType: string;
            let defaultLayout: RegisterManagerPlugin['defaultLayout'] | {h: number; w: number};
            if (sharedItem) {
                const {type, h, w} = sharedItem;
                dragItemType = type;
                const _defaults = props.registerManager.getItem(type);
                defaultLayout = _defaults ? {..._defaults.defaultLayout, h, w} : {h, w};
            } else if (dragOverPlugin) {
                dragItemType = dragOverPlugin.type;
                defaultLayout = dragOverPlugin.defaultLayout;
            } else {
                return false;
            }

            let maxW = gridProps.cols;
            const maxH = Math.min(
                gridProps.maxRows || Infinity,
                'maxH' in defaultLayout && defaultLayout.maxH ? defaultLayout.maxH : Infinity,
            );

            if (gridProps.compactType === COMPACT_TYPE_HORIZONTAL_NOWRAP && gridProps.cols) {
                maxW = groupLayout.reduce((memo, item) => memo - item.w, gridProps.cols);
            }

            if (
                maxW === 0 ||
                maxH === 0 ||
                ('minW' in defaultLayout &&
                    defaultLayout.minW &&
                    maxW &&
                    maxW < defaultLayout.minW) ||
                ('minH' in defaultLayout && defaultLayout.minH && maxH < defaultLayout.minH)
            ) {
                return false;
            }

            const {
                h = defaultLayout?.h || DEFAULT_WIDGET_HEIGHT,
                w = defaultLayout?.w || DEFAULT_WIDGET_WIDTH,
            } = dragPropsContext?.layout || {};

            const itemLayout = {
                h: maxH ? Math.min(h, maxH) : h,
                w: maxW ? Math.min(w, maxW) : w,
            };

            if (
                onDropDragOverContext?.(
                    {
                        ...sharedItem,
                        ...itemLayout,
                        parent: group,
                        type: dragItemType,
                    },
                    sharedItem ?? null,
                ) === false
            ) {
                return false;
            }

            return itemLayout;
        },
        [
            props.registerManager,
            resetTemporaryLayout,
            temporaryLayout,
            dragOverPlugin,
            dragPropsContext,
            onDropDragOverContext,
        ],
    );

    const onDropProp = props.onDrop;
    const onDrop = React.useCallback<DashKitCtxShape['onDrop']>(
        (newLayout, item) => {
            if (!dragPropsContext) {
                return;
            }

            setTemporaryLayout({
                data: [...newLayout, item],
                dragProps: dragPropsContext,
            });

            onDropProp?.({
                newLayout: newLayout.reduce<ConfigLayout[]>((memo, l) => {
                    if (l.i !== item.i) {
                        memo.push(pick(l, CONFIG_LAYOUT_FIELDS));
                    }

                    return memo;
                }, []),
                itemLayout: pick(item, CONFIG_LAYOUT_FIELDS),
                commit: resetTemporaryLayout,
                dragProps: dragPropsContext,
            });
        },
        [dragPropsContext, onDropProp, setTemporaryLayout, resetTemporaryLayout],
    );

    const dashkitContextValue = React.useMemo(
        () => ({
            externalLayoutRevision,
            config: props.config,
            configItems,
            groups: props.groups,
            context: props.context,
            noOverlay: props.noOverlay,
            focusable: props.focusable,
            defaultGlobalParams: props.globalParams,
            globalParams: props.globalParams,
            editMode: props.editMode,
            settings: props.settings,
            onItemMountChange: props.onItemMountChange,
            onItemRender: props.onItemRender,
            draggableHandleClassName: props.draggableHandleClassName,

            registerManager: props.registerManager,
            forwardedMetaRef: props.forwardedMetaRef,

            layout: resultLayout,
            temporaryLayout,
            layoutChange: onLayoutChange,
            memorizeOriginalLayout,
            revertToOriginalLayout,

            itemsState,
            itemsParams,
            onItemStateAndParamsChange,

            getItemsMeta,
            reloadItems,

            onDrop,
            onDropDragOver,
            outerDnDEnable,
            dragOverPlugin,

            onItemFocus: props.onItemFocus,
            onItemBlur: props.onItemBlur,

            /* default handlers bypass */
            onDragStart: props.onDragStart,
            onDrag: props.onDrag,
            onDragStop: props.onDragStop,
            onResizeStart: props.onResizeStart,
            onResize: props.onResize,
            onResizeStop: props.onResizeStop,
        }),
        [
            externalLayoutRevision,
            resultLayout,
            temporaryLayout,
            props.config,
            configItems,
            props.groups,
            props.context,
            props.noOverlay,
            props.focusable,
            props.globalParams,
            props.editMode,
            props.settings,
            itemsState,
            itemsParams,
            props.registerManager,
            onItemStateAndParamsChange,
            onDrop,
            onDropDragOver,
            onLayoutChange,
            props.onItemMountChange,
            props.onItemRender,
            getItemsMeta,
            reloadItems,
            memorizeOriginalLayout,
            revertToOriginalLayout,
            props.forwardedMetaRef,
            props.draggableHandleClassName,
            outerDnDEnable,
            dragOverPlugin,

            props.onItemFocus,
            props.onItemBlur,

            props.onDragStart,
            props.onDrag,
            props.onDragStop,
            props.onResizeStart,
            props.onResize,
            props.onResizeStop,
        ],
    );

    const overlayMenuItems = props.overlayMenuItems || props.registerManager.settings.menu;
    const controlsContextValue = React.useMemo(
        () => ({
            overlayControls: props.overlayControls,
            context: props.context,

            itemsStateAndParams: props.itemsStateAndParams,
            itemsState,
            itemsParams,

            getPreparedCopyItemOptions: props.getPreparedCopyItemOptions,
            onCopyFulfill: props.onCopyFulfill,

            menu: overlayMenuItems,

            editItem: props.onItemEdit,
            removeItem: onItemRemove,
            getLayoutItem: getLayoutItem,
        }),
        [
            props.overlayControls,
            props.context,
            props.itemsStateAndParams,
            props.onItemEdit,
            props.getPreparedCopyItemOptions,
            props.onCopyFulfill,
            overlayMenuItems,
            itemsState,
            itemsParams,
            onItemRemove,
            getLayoutItem,
        ],
    );

    return {controlsContextValue, dashkitContextValue};
}

export function withContext(Component: React.ComponentType) {
    const WithContext = (props: DashKitWithContextProps) => {
        const {dashkitContextValue, controlsContextValue} = useMemoStateContext(props);

        return (
            <DashKitContext.Provider value={dashkitContextValue}>
                <DashkitOverlayControlsContext.Provider value={controlsContextValue}>
                    <Component />
                </DashkitOverlayControlsContext.Provider>
            </DashKitContext.Provider>
        );
    };

    WithContext.displayName = `withContext(${
        Component.displayName || Component.name || 'Component'
    })`;

    return WithContext;
}
