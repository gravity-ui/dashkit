import React from 'react';
import {DashKitContext} from '../context/DashKitContext';
import {UpdateManager} from '../utils';
import {getItemsParams, getItemsState} from '../shared';
import PropTypes from 'prop-types';
import isEqual from 'lodash/isEqual';
import {utils as gridLayoutUtils} from 'react-grid-layout';

const LAYOUT_COMPACTING_TYPE = 'vertical';

export function withContext(Component) {
    return class DashKitWithContext extends React.Component {
        static propTypes = {
            editMode: PropTypes.bool,
            context: PropTypes.object,
            overlayControls: PropTypes.object,
            config: PropTypes.object,
            onItemEdit: PropTypes.func,
            onChange: PropTypes.func,
            defaultGlobalParams: PropTypes.object,
            globalParams: PropTypes.object,
            itemsStateAndParams: PropTypes.object,
            registerManager: PropTypes.object,
            layout: PropTypes.array,
            settings: PropTypes.object,
            forwardedMetaRef: PropTypes.object,
            noOverlay: PropTypes.bool,
            draggableHandleClassName: PropTypes.string,
        };

        // так как мы не хотим хранить параметры виджета с активированной автовысотой в сторе и на сервере, актуальный
        // (видимый юзером в конкретный момент времени) лэйаут (массив объектов с данными о ширине, высоте,
        // расположении конкретного виджета на сетке) будет храниться в стейте, но, для того, чтобы в стор попадал
        // лэйаут без учета вижетов с активированной автовысотой, в момент "подстройки" высоты виджета значение h
        // (высота) из конфига будет запоминаться в originalLayouts, новое значение высоты в adjustedLayouts
        state = {currentLayout: this.props.layout};

        originalLayouts = {};
        adjustedLayouts = {};

        _onChange({
            config = this.props.config,
            itemsStateAndParams = this.props.itemsStateAndParams,
        }) {
            if (
                !(
                    isEqual(config, this.props.config) &&
                    isEqual(itemsStateAndParams, this.props.itemsStateAndParams)
                )
            ) {
                this.props.onChange({
                    config,
                    itemsStateAndParams,
                });
            }
        }

        // каллбэк вызывающийся при изменение лэйаута сетки, первым аргументом приходит актуальный конфиг лэйаута,
        // т.е. если на текущей сетке есть виджеты, с активированной опцией автовысоты, их параметр "h" будет
        // "подстроенный"; чтобы, для сохранения в сторе "ушли" значения без учёта подстройки (как если бы у этих
        // виджетов автовысота была деактивирована) корректируем их используя this.originalLayouts
        _onLayoutChange = (layout) => {
            const currentLayout = layout.map((item) => {
                if (item.i in this.originalLayouts) {
                    return {
                        ...this.originalLayouts[item.i],
                        w: item.w,
                        x: item.x,
                        y: item.y,
                    };
                } else {
                    return {...item};
                }
            });

            // после того, как у виждета активировали автовысоту и его параметр "h" изменился, это приведёт, также, и к
            // изменению параметра (координаты) "y" у элементов расположенных под ним, поэтому, после того, как
            // значения параметра "h" виджетов с активированной автовысотой были изменены, необходимо изменить и
            // координату "y" виджетов расположенных ниже
            const compactedLayout = gridLayoutUtils.compact(
                currentLayout,
                LAYOUT_COMPACTING_TYPE,
                this.props.registerManager.gridLayout.cols,
            );

            const newConfig = UpdateManager.updateLayout({
                layout: compactedLayout,
                config: this.props.config,
            });

            if (!isEqual(newConfig.layout, this.props.config.layout)) {
                this._onChange({
                    config: newConfig,
                });
            }
        };

        _onItemRemove = (id) => {
            const {config, itemsStateAndParams} = this.props;
            this._onChange(UpdateManager.removeItem({id, config, itemsStateAndParams}));
        };

        _onItemEdit = (configItem) => {
            this.props.onItemEdit(configItem);
        };

        _onItemStateAndParamsChange = (id, stateAndParams) => {
            const {config, itemsStateAndParams} = this.props;
            this._onChange({
                itemsStateAndParams: UpdateManager.changeStateAndParams({
                    id,
                    config,
                    stateAndParams,
                    itemsStateAndParams,
                }),
            });
        };

        _memorizeOriginalLayout = (widgetId, preAutoHeightLayout, postAutoHeightLayout) => {
            if (!(widgetId in this.originalLayouts)) {
                this.originalLayouts[widgetId] = preAutoHeightLayout;
            }

            this.adjustedLayouts[widgetId] = postAutoHeightLayout;

            this.setState({
                currentLayout: this.props.layout.map((item) => {
                    if (item.i in this.adjustedLayouts) {
                        return {
                            ...this.adjustedLayouts[item.i],
                            w: item.w,
                            x: item.x,
                            y: item.y,
                        };
                    } else {
                        return {...item};
                    }
                }),
            });
        };

        _revertToOriginalLayout = (widgetId) => {
            this.setState({
                currentLayout: this.state.currentLayout.map((item) => {
                    if (item.i === widgetId) {
                        return {
                            ...this.originalLayouts[item.i],
                            w: item.w,
                            x: item.x,
                            y: item.y,
                        };
                    } else {
                        return {...item};
                    }
                }),
            });

            delete this.adjustedLayouts[widgetId];
            delete this.originalLayouts[widgetId];
        };

        get _itemsParams() {
            const {
                config,
                itemsStateAndParams,
                globalParams,
                defaultGlobalParams,
                registerManager,
            } = this.props;
            return getItemsParams({
                defaultGlobalParams,
                globalParams,
                config,
                itemsStateAndParams,
                plugins: registerManager.getPlugins(),
            });
        }

        get _itemsState() {
            const {config, itemsStateAndParams} = this.props;
            return getItemsState({config, itemsStateAndParams});
        }

        _getItemsMeta = (pluginsRefs) => {
            return pluginsRefs
                .map((ref) => {
                    if (!(ref && typeof ref.getMeta === 'function')) {
                        return undefined;
                    }
                    return ref.getMeta();
                })
                .filter(Boolean);
        };

        _getLayout = () => {
            return this.props.layout.map((item) => {
                if (item.i in this.adjustedLayouts) {
                    return {
                        ...this.adjustedLayouts[item.i],
                        w: item.w,
                        x: item.x,
                        y: item.y,
                    };
                } else {
                    return {...item};
                }
            });
        };

        _reloadItems = (pluginsRefs, data) => {
            pluginsRefs.forEach((ref) => ref && ref.reload && ref.reload(data));
        };

        get _contextValue() {
            return {
                getLayout: this._getLayout,
                config: this.props.config,
                context: this.props.context,
                overlayControls: this.props.overlayControls,
                noOverlay: this.props.noOverlay,
                defaultGlobalParams: this.props.globalParams,
                globalParams: this.props.globalParams,
                editMode: this.props.editMode,
                settings: this.props.settings,
                itemsState: this._itemsState,
                itemsParams: this._itemsParams,
                registerManager: this.props.registerManager,
                onItemStateAndParamsChange: this._onItemStateAndParamsChange,
                removeItem: this._onItemRemove,
                editItem: this._onItemEdit,
                layoutChange: this._onLayoutChange,
                getItemsMeta: this._getItemsMeta,
                reloadItems: this._reloadItems,
                memorizeOriginalLayout: this._memorizeOriginalLayout,
                revertToOriginalLayout: this._revertToOriginalLayout,
                forwardedMetaRef: this.props.forwardedMetaRef,
                draggableHandleClassName: this.props.draggableHandleClassName,
            };
        }

        render() {
            return (
                <DashKitContext.Provider value={this._contextValue}>
                    <Component />
                </DashKitContext.Provider>
            );
        }
    };
}
