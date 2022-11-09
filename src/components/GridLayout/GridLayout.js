import React from 'react';
import ReactGridLayout, {WidthProvider} from 'react-grid-layout';
import GridItem from '../GridItem/GridItem';
import {DashKitContext} from '../../context/DashKitContext';

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
        const {getLayout, memorizeOriginalLayout, revertToOriginalLayout} = this.context;

        if (needSetDefault) {
            revertToOriginalLayout(widgetId);
            return;
        }

        if (!adjustedWidgetLayout) {
            return;
        }

        const layout = getLayout();
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
        this.setState({isDragging: true});
    };

    _onStop = (newLayout) => {
        const {layoutChange} = this.context;

        layoutChange(newLayout);
        this.setState({isDragging: false});
    };

    render() {
        const {getLayout, config, registerManager, editMode, noOverlay, draggableHandleClassName} =
            this.context;
        this.pluginsRefs.length = config.items.length;
        const layout = getLayout();
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
            >
                {config.items.map((item, i) => {
                    return (
                        <GridItem
                            ref={(pluginRef) => {
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
