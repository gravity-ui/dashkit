import React from 'react';
import ReactGridLayout, {WidthProvider} from 'react-grid-layout';
import GridItem from '../GridItem/GridItem';
import {DashKitContext} from '../../context/DashKitContext';
import {FAKE_NEW_ITEM_ID} from '../../constants';

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

    addItem = (layout) => this.context.addByDrop(layout);

    _onStart = () => {
        this.setState({isDragging: true});
    };

    _onStop = (newLayout) => {
        this.resetHover();
        const {layoutChange} = this.context;

        layoutChange(newLayout);
        this.setState({isDragging: false});
    };

    _onDrop = (layout, layoutItem) => {
        this.resetHover();
        this.addItem(layout, layoutItem);
    };

    // TODO
    resetHover = () => {
        /*const gridItems = document.querySelectorAll('.dashkit-grid-item__overlay') || [];
        if (!gridItems.length) {
            return;
        }
        gridItems.forEach((_item) => {
            item.style.borderRightColor = 'rgba(0, 0, 0, 0.1)';
        });*/
    };

    // TODO
    hoverItem = (el) => {
        this.resetHover();
        if (!el) {
            return;
        }
        //el.style.borderRightColor = '#f00';
    };

    // TODO
    _onDropDragOver = () => {
        //console.log(e);
        const selectItem = document.querySelector(
            '.dashkit-grid-item:nth-child(2) .dashkit-grid-item__overlay',
        );
        this.hoverItem(selectItem);
    };

    render() {
        const {
            layout,
            config,
            registerManager,
            editMode,
            noOverlay,
            draggableHandleClassName,
            dragFromOutside,
        } = this.context;
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
                onDrop={this._onDrop}
                onDropDragOver={this._onDropDragOver}
                {...(draggableHandleClassName
                    ? {draggableHandle: `.${draggableHandleClassName}`}
                    : null)}
                isDroppable={Boolean(dragFromOutside)}
                droppingItem={{i: FAKE_NEW_ITEM_ID, h: 4, w: 5}} // TODO sizes
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
