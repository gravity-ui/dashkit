import React from 'react';

import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import {
    COMPACT_TYPE_HORIZONTAL_NOWRAP,
    DEFAULT_GROUP,
    DEFAULT_WIDGET_HEIGHT,
    DEFAULT_WIDGET_WIDTH,
    TEMPORARY_ITEM_ID,
} from '../constants/common';
import {
    DashKitContext,
    DashKitDnDContext,
    DashkitOvelayControlsContext,
} from '../context/DashKitContext';
import {useDeepEqualMemo} from '../hooks/useDeepEqualMemo';
import {getItemsParams, getItemsState} from '../shared';
import {UpdateManager} from '../utils';

const ITEM_PROPS = ['i', 'h', 'w', 'x', 'y', 'parent'];

function useMemoStateContext(props) {
    // так как мы не хотим хранить параметры виджета с активированной автовысотой в сторе и на сервере, актуальный
    // (видимый юзером в конкретный момент времени) лэйаут (массив объектов с данными о ширине, высоте,
    // расположении конкретного виджета на сетке) будет храниться в стейте, но, для того, чтобы в стор попадал
    // лэйаут без учета вижетов с активированной автовысотой, в момент "подстройки" высоты виджета значение h
    // (высота) из конфига будет запоминаться в originalLayouts, новое значение высоты в adjustedLayouts

    const originalLayouts = React.useRef({});
    const adjustedLayouts = React.useRef({});
    const nowrapAdjustedLayouts = React.useRef({});

    const [temporaryLayout, setTemporaryLayout] = React.useState(null);
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
        (layout) => {
            const currentInnerLayout = layout.map((item) => {
                if (item.i in originalLayouts.current) {
                    // eslint-disable-next-line no-unused-vars
                    const {parent, ...originalCopy} = originalLayouts.current[item.i];

                    // Updating original if parent has changed and saving copy as original
                    // or leaving default
                    if (item.parent) {
                        originalCopy.parent = item.parent;
                    }
                    originalCopy.w = item.w;
                    originalCopy.x = item.x;
                    originalCopy.y = item.y;

                    return originalCopy;
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
        (id) => {
            return props.config.layout.find(({i}) => i === id);
        },
        [props.config.layout],
    );

    const onItemRemove = React.useCallback(
        (id) => {
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
            props.config,
            props.itemsStateAndParams,
            temporaryLayout,
            onChange,
            setTemporaryLayout,
            resetTemporaryLayout,
        ],
    );

    const onItemStateAndParamsChange = React.useCallback(
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

    const memorizeOriginalLayout = React.useCallback(
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

    const revertToOriginalLayout = React.useCallback((widgetId) => {
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
        const defaultProps = props.registerManager._gridLayout || {};
        const nowrapGroups = {};
        let hasNowrapGroups = false;

        if (defaultProps.compactType === COMPACT_TYPE_HORIZONTAL_NOWRAP) {
            nowrapGroups[DEFAULT_GROUP] = {
                items: [],
                leftSpace: defaultProps.cols,
            };
            hasNowrapGroups = true;
        }

        if (groups) {
            groups.forEach((group) => {
                const resultProps = group.gridProperties?.(defaultProps) || {};

                if (resultProps.compactType === COMPACT_TYPE_HORIZONTAL_NOWRAP) {
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
                const parentId = item.parent || DEFAULT_GROUP;

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

    const getItemsMeta = React.useCallback((pluginsRefs) => {
        return pluginsRefs
            .map((ref) => {
                if (!(ref && typeof ref.getMeta === 'function')) {
                    return undefined;
                }
                return ref.getMeta();
            })
            .filter(Boolean);
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
                const {parent, ...adjustedItem} = adjusted[widgetId] || item;

                adjustedItem.w = item.w;
                adjustedItem.x = item.x;
                adjustedItem.y = item.y;

                if (item.parent) {
                    adjustedItem.parent = item.parent;
                }

                if (widgetId in nowrapAdjust) {
                    adjustedItem.maxW = nowrapAdjust[widgetId];
                }

                return adjustedItem;
            } else {
                if (widgetId in original) {
                    delete original[widgetId];
                }
                return item;
            }
        });
    }, [props.layout, layoutUpdateCounter]);

    const reloadItems = React.useCallback((pluginsRefs, data) => {
        pluginsRefs.forEach((ref) => ref && ref.reload && ref.reload(data));
    }, []);

    const dragProps = dndContext?.dragProps;

    const dragOverPlugin = React.useMemo(() => {
        if (!dragProps) {
            return null;
        }

        const pluginType = dragProps.type;

        if (props.registerManager.check(pluginType)) {
            return props.registerManager.getItem(pluginType);
        } else {
            // eslint-disable-next-line no-console
            console.error(`Uknown pluginType: ${pluginType}`);
            return null;
        }
    }, [dragProps, props.registerManager]);

    const onDropDragOver = React.useCallback(
        (_e, gridProps, groupLayout, sharedItem) => {
            if (temporaryLayout) {
                resetTemporaryLayout();
                return false;
            }

            let defaultLayout;
            if (sharedItem) {
                const {type, h, w} = sharedItem;
                const _defaults = props.registerManager.getItem(type);
                defaultLayout = _defaults ? {..._defaults.defaultLayout, h, w} : {h, w};
            } else if (dragOverPlugin) {
                defaultLayout = dragOverPlugin.defaultLayout;
            } else {
                return false;
            }

            let maxW = gridProps.cols;
            const maxH = Math.min(gridProps.maxRows || Infinity, defaultLayout.maxH || Infinity);

            if (gridProps.compactType === COMPACT_TYPE_HORIZONTAL_NOWRAP) {
                maxW = groupLayout.reduce((memo, item) => memo - item.w, gridProps.cols);
            }

            if (
                maxW === 0 ||
                maxH === 0 ||
                maxW < defaultLayout.minW ||
                maxH < defaultLayout.minH
            ) {
                return false;
            }

            const {
                h = defaultLayout?.h || DEFAULT_WIDGET_HEIGHT,
                w = defaultLayout?.w || DEFAULT_WIDGET_WIDTH,
            } = dragProps?.layout || {};

            return {
                h: maxH ? Math.min(h, maxH) : h,
                w: maxW ? Math.min(w, maxW) : w,
            };
        },
        [resetTemporaryLayout, temporaryLayout, dragOverPlugin, dragProps],
    );

    const onDropProp = props.onDrop;
    const onDrop = React.useCallback(
        (newLayout, item) => {
            if (!dragProps) {
                return;
            }

            setTemporaryLayout({
                data: newLayout,
                dragProps,
            });

            onDropProp({
                newLayout: newLayout.reduce((memo, l) => {
                    if (l.i !== item.i) {
                        memo.push(pick(l, ITEM_PROPS));
                    }

                    return memo;
                }, []),
                itemLayout: pick(item, ITEM_PROPS),
                commit: resetTemporaryLayout,
                dragProps,
            });
        },
        [dragProps, onDropProp, setTemporaryLayout, resetTemporaryLayout],
    );

    const dashkitContextValue = React.useMemo(
        () => ({
            layout: resultLayout,
            temporaryLayout,
            config: props.config,
            groups: props.groups,
            context: props.context,
            noOverlay: props.noOverlay,
            focusable: props.focusable,
            defaultGlobalParams: props.globalParams,
            globalParams: props.globalParams,
            editMode: props.editMode,
            settings: props.settings,
            itemsState,
            itemsParams,
            registerManager: props.registerManager,
            onItemStateAndParamsChange,
            onDrop,
            onDropDragOver,
            layoutChange: onLayoutChange,
            getItemsMeta,
            reloadItems,
            memorizeOriginalLayout,
            revertToOriginalLayout,
            forwardedMetaRef: props.forwardedMetaRef,
            draggableHandleClassName: props.draggableHandleClassName,
            outerDnDEnable,
            dragOverPlugin,
        }),
        [
            resultLayout,
            temporaryLayout,
            props.config,
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
            getItemsMeta,
            reloadItems,
            memorizeOriginalLayout,
            revertToOriginalLayout,
            props.forwardedMetaRef,
            props.draggableHandleClassName,
            outerDnDEnable,
            dragOverPlugin,
        ],
    );

    const overlayMenuItems = props.overlayMenuItems || props.registerManager.settings.menu;
    const controlsContextValue = React.useMemo(
        () => ({
            overlayControls: props.overlayControls,
            context: props.context,
            menu: overlayMenuItems,
            itemsParams: itemsParams,
            itemsState: itemsState,
            editItem: props.onItemEdit,
            removeItem: onItemRemove,
            getLayoutItem: getLayoutItem,
        }),
        [
            itemsParams,
            itemsState,
            props.context,
            props.onItemEdit,
            onItemRemove,
            props.overlayControls,
            overlayMenuItems,
            getLayoutItem,
        ],
    );

    return {controlsContextValue, dashkitContextValue};
}

export function withContext(Component) {
    const WithContext = (props) => {
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
    }`;

    return WithContext;
}
