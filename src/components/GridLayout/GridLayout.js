import React from 'react';

import {OVERLAY_CONTROLS_CLASS_NAME, TEMPORARY_ITEM_ID} from '../../constants';
import {DashKitContext} from '../../context/DashKitContext';
import GridItem from '../GridItem/GridItem';

import {Layout} from './ReactGridLayout';

export default class GridLayout extends React.PureComponent {
    constructor(props, context) {
        super(props, context);
        this.pluginsRefs = [];
        this.state = {
            isDragging: false,
            isPageHidden: false,
        };
    }

    componentDidMount() {
        this.reloadItems();
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    componentDidUpdate() {
        clearTimeout(this._timeout);
        this.reloadItems();
    }

    componentWillUnmount() {
        clearTimeout(this._timeout);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }

    static contextType = DashKitContext;

    _timeout;
    _lastReloadAt;

    onVisibilityChange = () => {
        this.setState({
            isPageHidden: document.hidden,
        });
    };

    adjustWidgetLayout = ({widgetId, needSetDefault, adjustedWidgetLayout}) => {
        const {layout, memorizeOriginalLayout, revertToOriginalLayout} = this.context;

        if (needSetDefault) {
            revertToOriginalLayout(widgetId);
            return;
        }

        if (!adjustedWidgetLayout) {
            return;
        }

        const correspondedLayoutItemIndex = layout.findIndex(
            (layoutItem) => layoutItem.i === widgetId,
        );

        memorizeOriginalLayout(
            widgetId,
            {...layout[correspondedLayoutItemIndex]},
            adjustedWidgetLayout,
        );
    };

    getItemsMeta = () => {
        const {getItemsMeta} = this.context;
        return getItemsMeta(this.pluginsRefs);
    };

    reloadItems() {
        const {
            editMode,
            settings: {autoupdateInterval, silentLoading} = {},
            reloadItems,
        } = this.context;
        const {isPageHidden} = this.state;
        const autoupdateIntervalMs = Number(autoupdateInterval) * 1000;
        if (autoupdateIntervalMs) {
            const timeSinceLastReload = new Date().getTime() - (this._lastReloadAt || 0);
            const reloadIntervalRemains = autoupdateIntervalMs - timeSinceLastReload;

            if (!isPageHidden && !editMode && reloadIntervalRemains <= 0) {
                this._lastReloadAt = new Date().getTime();
                reloadItems(this.pluginsRefs, {silentLoading, noVeil: true});
            }

            this._timeout = setTimeout(
                () => this.reloadItems(),
                reloadIntervalRemains <= 0 ? autoupdateIntervalMs : reloadIntervalRemains,
            );
        }
    }

    _onStart = () => {
        if (this.temporaryLayout) return;

        this.setState({isDragging: true});
    };

    _onStop = (newLayout) => {
        const {layoutChange, onDrop, temporaryLayout} = this.context;

        if (temporaryLayout) {
            onDrop?.(
                newLayout,
                newLayout.find(({i}) => i === TEMPORARY_ITEM_ID),
            );
        } else {
            layoutChange(newLayout);
        }
        this.setState({isDragging: false});
    };

    _onDropDragOver = (e) => {
        const {editMode, dragOverPlugin, onDropDragOver, temporaryLayout} = this.context;

        if (!editMode || !dragOverPlugin || temporaryLayout) {
            return false;
        }

        return onDropDragOver(e);
    };

    _onDrop = (layout, item, e) => {
        if (!item) {
            return false;
        }

        const {editMode, temporaryLayout, onDrop} = this.context;
        if (!editMode && temporaryLayout) {
            return false;
        }

        onDrop?.(layout, item, e);
    };

    renderTemporaryPlaceholder() {
        const {temporaryLayout, dragOverPlugin, noOverlay, draggableHandleClassName} = this.context;

        if (!temporaryLayout || !dragOverPlugin) {
            return null;
        }

        const id = TEMPORARY_ITEM_ID;
        const type = dragOverPlugin.type;

        return (
            <GridItem
                key={id}
                id={id}
                item={{id, type, data: {}}}
                layout={temporaryLayout}
                adjustWidgetLayout={this.adjustWidgetLayout}
                isDragging={this.state.isDragging}
                isPlaceholder={true}
                noOverlay={noOverlay}
                withCustomHandle={Boolean(draggableHandleClassName)}
                overlayControls={this.props.overlayControls}
            />
        );
    }

    render() {
        const {
            layout,
            temporaryLayout,
            config,
            registerManager,
            editMode,
            noOverlay,
            focusable,
            draggableHandleClassName,
            outerDnDEnable,
        } = this.context;
        this.pluginsRefs.length = config.items.length;

        return (
            <Layout
                {...registerManager.gridLayout}
                layout={temporaryLayout || layout}
                isDraggable={editMode}
                isResizable={editMode}
                onDragStart={this._onStart}
                onDragStop={this._onStop}
                onResizeStart={this._onStart}
                onResizeStop={this._onStop}
                {...(draggableHandleClassName
                    ? {draggableHandle: `.${draggableHandleClassName}`}
                    : null)}
                {...(outerDnDEnable
                    ? {
                          isDroppable: true,
                          onDropDragOver: this._onDropDragOver,
                          onDrop: this._onDrop,
                      }
                    : null)}
                draggableCancel={`.${OVERLAY_CONTROLS_CLASS_NAME}`}
            >
                {config.items.map((item, i) => {
                    return (
                        <GridItem
                            forwardedPluginRef={(pluginRef) => {
                                this.pluginsRefs[i] = pluginRef;
                            }} // forwarded ref to plugin
                            key={item.id}
                            id={item.id}
                            item={item}
                            layout={temporaryLayout || layout}
                            adjustWidgetLayout={this.adjustWidgetLayout}
                            isDragging={this.state.isDragging}
                            noOverlay={noOverlay}
                            focusable={focusable}
                            withCustomHandle={Boolean(draggableHandleClassName)}
                            overlayControls={this.props.overlayControls}
                        />
                    );
                })}
                {this.renderTemporaryPlaceholder()}
            </Layout>
        );
    }
}
