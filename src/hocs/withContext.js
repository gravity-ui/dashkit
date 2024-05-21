import React from 'react';

import isEqual from 'lodash/isEqual';

import {DEFAULT_WIDGET_HEIGHT, DEFAULT_WIDGET_WIDTH, TEMPORARY_ITEM_ID} from '../constants/common';
import {DashKitContext, DashKitDnDContext} from '../context/DashKitContext';
import {getItemsParams, getItemsState} from '../shared';
import {UpdateManager} from '../utils';

function useMemoStateContext(props) {
    // так как мы не хотим хранить параметры виджета с активированной автовысотой в сторе и на сервере, актуальный
    // (видимый юзером в конкретный момент времени) лэйаут (массив объектов с данными о ширине, высоте,
    // расположении конкретного виджета на сетке) будет храниться в стейте, но, для того, чтобы в стор попадал
    // лэйаут без учета вижетов с активированной автовысотой, в момент "подстройки" высоты виджета значение h
    // (высота) из конфига будет запоминаться в originalLayouts, новое значение высоты в adjustedLayouts

    const originalLayouts = React.useRef({});
    const adjustedLayouts = React.useRef({});
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
        ({config = props.config, itemsStateAndParams = props.itemsStateAndParams}) => {
            if (
                !(
                    isEqual(config, props.config) &&
                    isEqual(itemsStateAndParams, props.itemsStateAndParams)
                )
            ) {
                props.onChange({config, itemsStateAndParams});
            }
        },
        [props.config, props.itemsStateAndParams, props.onChange],
    );

    // каллбэк вызывающийся при изменение лэйаута сетки, первым аргументом приходит актуальный конфиг лэйаута,
    // т.е. если на текущей сетке есть виджеты, с активированной опцией автовысоты, их параметр "h" будет
    // "подстроенный"; чтобы, для сохранения в сторе "ушли" значения без учёта подстройки (как если бы у этих
    // виджетов автовысота была деактивирована) корректируем их используя this.originalLayouts
    const onLayoutChange = React.useCallback(
        (layout) => {
            const currentInnerLayout = layout.map((item) => {
                if (item.i in originalLayouts.current) {
                    return {
                        ...originalLayouts.current[item.i],
                        w: item.w,
                        x: item.x,
                        y: item.y,
                    };
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

    const onItemRemove = React.useCallback(
        (id) => {
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

    const itemsParams = React.useMemo(
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

    const itemsState = React.useMemo(
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
        return props.layout.map((item) => {
            if (item.i in adjustedLayouts.current) {
                return {
                    ...adjustedLayouts.current[item.i],
                    w: item.w,
                    x: item.x,
                    y: item.y,
                };
            } else {
                return {...item};
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

    const onDropDragOver = React.useCallback(() => {
        if (temporaryLayout) {
            resetTemporaryLayout();
            return false;
        }

        if (dragOverPlugin) {
            const {defaultLayout} = dragOverPlugin;
            const {
                h = defaultLayout?.h || DEFAULT_WIDGET_HEIGHT,
                w = defaultLayout?.w || DEFAULT_WIDGET_WIDTH,
            } = dragProps.layout || {};

            return {h, w};
        }

        return false;
    }, [resetTemporaryLayout, temporaryLayout, dragOverPlugin, dragProps]);

    const onDrop = React.useCallback(
        (newLayout, item) => {
            if (!dragProps) {
                return;
            }

            setTemporaryLayout({
                data: newLayout,
                dragProps,
            });
            const {i, w, h, x, y} = item;

            props.onDrop({
                newLayout: newLayout.reduce((memo, l) => {
                    if (l.i !== i) {
                        memo.push({i: l.i, w: l.w, h: l.h, x: l.x, y: l.y});
                    }
                    return memo;
                }, []),
                itemLayout: {w, h, x, y},
                commit: resetTemporaryLayout,
                dragProps,
            });
        },
        [dragProps, props.onDrop, setTemporaryLayout, resetTemporaryLayout],
    );

    return React.useMemo(
        () => ({
            layout: resultLayout,
            temporaryLayout,
            config: props.config,
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
            removeItem: onItemRemove,
            onDrop,
            onDropDragOver,
            editItem: props.onItemEdit,
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
            onItemRemove,
            onDrop,
            onDropDragOver,
            props.onItemEdit,
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
}

export function withContext(Component) {
    const WithContext = (props) => {
        const contextValue = useMemoStateContext(props);

        return (
            <DashKitContext.Provider value={contextValue}>
                <Component overlayControls={props.overlayControls} />
            </DashKitContext.Provider>
        );
    };

    WithContext.displayName = `withContext(${
        Component.displayName || Component.name || 'Component'
    }`;

    return WithContext;
}
