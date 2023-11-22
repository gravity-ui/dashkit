import React from 'react';
import ReactGridLayout, {WidthProvider} from 'react-grid-layout';
import GridItem from '../GridItem/GridItem';
import {DashKitContext} from '../../context/DashKitContext';
import {OVERLAY_CONTROLS_CLASS_NAME} from '../../constants';

const Layout = WidthProvider(ReactGridLayout); // eslint-disable-line new-cap

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
        this.forceReloadItems();
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

    getAutoupdateIntervalMs() {
        const {settings: {autoupdateInterval} = {}} = this.context;
        const autoupdateIntervalMs = Number(autoupdateInterval) * 1000;
        return autoupdateIntervalMs;
    }

    startReloadItems() {
        const {editMode, settings: {silentLoading} = {}, reloadItems} = this.context;
        const {isPageHidden} = this.state;

        if (!isPageHidden && !editMode) {
            this._lastReloadAt = new Date().getTime();
            return reloadItems(this.pluginsRefs, {silentLoading, noVeil: true});
        }

        return Promise.resolve();
    }

    startReloadItemsTimeout(timeoutMs) {
        this._timeout = setTimeout(() => this.forceReloadItems(), timeoutMs);
    }

    forceReloadItems() {
        clearTimeout(this._timeout);
        this._timeout = undefined;
        this.reloadItems();
    }

    reloadItems() {
        if (this._timeout) return;

        const {settings: {realtimeMode, realtimeModeDelayMs = 5000} = {}} = this.context;

        if (realtimeMode) {
            this.startReloadItems().then(() => {
                this.startReloadItemsTimeout(realtimeModeDelayMs);
            });
            return;
        }

        const autoupdateIntervalMs = this.getAutoupdateIntervalMs();
        if (autoupdateIntervalMs) {
            this.startReloadItems();
            this.startReloadItemsTimeout(autoupdateIntervalMs);
        }
    }

    _onStart = () => {
        this.setState({isDragging: true});
    };

    _onStop = (newLayout) => {
        const {layoutChange} = this.context;

        layoutChange(newLayout);
        this.setState({isDragging: false});
    };

    render() {
        const {layout, config, registerManager, editMode, noOverlay, draggableHandleClassName} =
            this.context;
        this.pluginsRefs.length = config.items.length;

        return (
            <Layout
                {...registerManager.gridLayout}
                layout={layout}
                isDraggable={editMode}
                isResizable={editMode}
                onDragStart={this._onStart}
                onDragStop={this._onStop}
                onResizeStart={this._onStart}
                onResizeStop={this._onStop}
                {...(draggableHandleClassName
                    ? {draggableHandle: `.${draggableHandleClassName}`}
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
                            layout={layout}
                            adjustWidgetLayout={this.adjustWidgetLayout}
                            isDragging={this.state.isDragging}
                            noOverlay={noOverlay}
                            withCustomHandle={Boolean(draggableHandleClassName)}
                            overlayControls={this.props.overlayControls}
                        />
                    );
                })}
            </Layout>
        );
    }
}
