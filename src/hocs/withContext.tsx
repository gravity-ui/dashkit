import React from 'react';

import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import type {
    OverlayControlItem,
    PreparedCopyItemOptions,
} from '../components/OverlayControls/OverlayControls';
import {
    COMPACT_TYPE_HORIZONTAL_NOWRAP,
    DEFAULT_GROUP,
    DEFAULT_WIDGET_HEIGHT,
    DEFAULT_WIDGET_WIDTH,
    TEMPORARY_ITEM_ID,
} from '../constants/common';
import {DashKitContext, DashKitDnDContext, DashkitOvelayControlsContext} from '../context';
import type {DashKitCtxShape, OverlayControlsCtxShape, TemporaryLayout} from '../context';
import {useDeepEqualMemo} from '../hooks/useDeepEqualMemo';
import type {
    Config,
    ConfigItem,
    ConfigLayout,
    GlobalParams,
    ItemDropProps,
    ItemsStateAndParams,
} from '../shared';
import {getAllConfigItems, getItemsParams, getItemsState} from '../shared';
import type {
    ContextProps,
    DashKitGroup,
    ItemManipulationCallback,
    MenuItem,
    PluginRef,
    SettingsProps,
} from '../typings';
import type {RegisterManager, RegisterManagerPlugin} from '../utils';
import {UpdateManager, resolveLayoutGroup} from '../utils';

const ITEM_PROPS = ['i', 'h', 'w', 'x', 'y', 'parent'] as const;

export type DashKitWithContextProps = {
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
    groups?: DashKitGroup[];
    onChange: (data: {
        config: Config;
        itemsStateAndParams: ItemsStateAndParams;
        groups?: DashKitGroup[];
    }) => void;
    layout: ConfigLayout[];
    registerManager: RegisterManager;
    defaultGlobalParams: GlobalParams;
    globalParams: GlobalParams;
    onItemEdit: (item: ConfigItem) => void;
    context: ContextProps;
    noOverlay: boolean;
    focusable?: boolean;
    settings: SettingsProps;
    onItemMountChange?: (item: ConfigItem, state: {isAsync: boolean; isMounted: boolean}) => void;
    onItemRender?: (item: ConfigItem) => void;
    forwardedMetaRef: React.ForwardedRef<any>;
    draggableHandleClassName?: string;
    onDrop?: (dropProps: ItemDropProps) => void;
    overlayControls?: Record<string, OverlayControlItem[]> | null;
    overlayMenuItems?: MenuItem[] | null;
    getPreparedCopyItemOptions?: (options: PreparedCopyItemOptions) => PreparedCopyItemOptions;
    onCopyFulfill?: (error: null | Error, data?: PreparedCopyItemOptions) => void;
    editMode: boolean;
    onItemFocus?: (item: ConfigItem) => void;
    onItemBlur?: (item: ConfigItem) => void;
    onDragStart?: ItemManipulationCallback;
    onDrag?: ItemManipulationCallback;
    onDragStop?: ItemManipulationCallback;
    onResizeStart?: ItemManipulationCallback;
    onResize?: ItemManipulationCallback;
    onResizeStop?: ItemManipulationCallback;
};

type OriginalLayouts = Record<string, ConfigLayout>;

type AdjustedLayouts = Record<string, ConfigLayout>;

type NowrapAdjustedLayouts = Record<string, number>;

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
    // так как мы не хотим хранить параметры виджета с активированной автовысотой в сторе и на сервере, актуальный
    // (видимый юзером в конкретный момент времени) лэйаут (массив объектов с данными о ширине, высоте,
    // расположении конкретного виджета на сетке) будет храниться в стейте, но, для того, чтобы в стор попадал
    // лэйаут без учета вижетов с активированной автовысотой, в момент "подстройки" высоты виджета значение h
    // (высота) из конфига будет запоминаться в originalLayouts, новое значение высоты в adjustedLayouts

    const originalLayouts = React.useRef<OriginalLayouts>({});
    const adjustedLayouts = React.useRef<AdjustedLayouts>({});
    const nowrapAdjustedLayouts = React.useRef<NowrapAdjustedLayouts>({});

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

    // каллбэк вызывающийся при изменение лэйаута сетки, первым аргументом приходит актуальный конфиг лэйаута,
    // т.е. если на текущей сетке есть виджеты, с активированной опцией автовысоты, их параметр "h" будет
    // "подстроенный"; чтобы, для сохранения в сторе "ушли" значения без учёта подстройки (как если бы у этих
    // виджетов автовысота была деактивирована) корректируем их используя this.originalLayouts
    const onLayoutChange = React.useCallback(
        (layout: ConfigLayout[]) => {
            const currentInnerLayout = layout.map((item) => {
                if (item.i in originalLayouts.current) {
                    // eslint-disable-next-line no-unused-vars
                    const {parent: _parent, ...originalCopy} = originalLayouts.current[item.i];

                    // Updating original if parent has changed and saving copy as original
                    // or leaving default
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

            const newConfig = UpdateManager.updateLayout({
                layout: currentInnerLayout,
                config: props.config,
            });

            if (!isEqual(newConfig.layout, props.config.layout)) {
                onChange({config: newConfig});
            }
        },
        [props.config, onChange],
    );

    const getLayoutItem = React.useCallback(
        (id: string) => {
            return props.config.layout.find(({i}) => i === id);
        },
        [props.config.layout],
    );

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
                        config: props.config,
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
            setTemporaryLayout,
        ],
    );

    const onItemStateAndParamsChange = React.useCallback<
        DashKitCtxShape['onItemStateAndParamsChange']
    >(
        (id, stateAndParams, options) => {
            onChange({
                itemsStateAndParams: UpdateManager.changeStateAndParams({
                    id,
                    config: props.config,
                    stateAndParams,
                    itemsStateAndParams: props.itemsStateAndParams,
                    options,
                }),
            });
        },
        [props.config, props.itemsStateAndParams, onChange],
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
        const layout = props.layout;
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
    }, [props.registerManager, props.groups, props.layout]);

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

        return props.layout.map((item) => {
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
    }, [props.layout, layoutUpdateCounter]);

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
                        memo.push(pick(l, ITEM_PROPS));
                    }

                    return memo;
                }, []),
                itemLayout: pick(item, ITEM_PROPS),
                commit: resetTemporaryLayout,
                dragProps: dragPropsContext,
            });
        },
        [dragPropsContext, onDropProp, setTemporaryLayout, resetTemporaryLayout],
    );

    const dashkitContextValue = React.useMemo(
        () => ({
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
                <DashkitOvelayControlsContext.Provider value={controlsContextValue}>
                    <Component />
                </DashkitOvelayControlsContext.Provider>
            </DashKitContext.Provider>
        );
    };

    WithContext.displayName = `withContext(${
        Component.displayName || Component.name || 'Component'
    })`;

    return WithContext;
}
