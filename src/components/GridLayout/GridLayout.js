import React from 'react';

import {OVERLAY_CONTROLS_CLASS_NAME, TEMPORARY_ITEM_ID} from '../../constants';
import {DashKitContext} from '../../context/DashKitContext';
import GridItem from '../GridItem/GridItem';

import {Layout} from './ReactGridLayout';

const HEADER_SIZE = 2;
const MAX_HEADER_SIZE = 10;

const FIXED_HEADER_ID = 'fixedHeader';

const FixedHeader = (props) => {
    const {registerManager, size, onSizeUpdate, layout, children} = props;

    const [isCollapsed, setCollapsed] = React.useState(false);
    const [isEditing, setEditing] = React.useState(false);

    const currentMaxSizeRef = React.useRef(HEADER_SIZE);
    const elementRef = React.useRef();
    const offsetRef = React.useRef();

    const onLayoutUpdate = React.useCallback(
        (layout) => {
            if (isCollapsed) {
                onSizeUpdate(HEADER_SIZE);
            } else {
                const maxH = layout.reduce((max, item) => {
                    const offset = item.y + item.h + HEADER_SIZE;

                    if (max < offset) {
                        return offset;
                    }

                    return max;
                }, HEADER_SIZE);

                if (isEditing) {
                    onSizeUpdate(maxH);
                } else {
                    onSizeUpdate(maxH > MAX_HEADER_SIZE ? MAX_HEADER_SIZE : maxH);
                }

                currentMaxSizeRef.current = maxH;
            }
        },
        [isCollapsed, isEditing, onSizeUpdate, currentMaxSizeRef],
    );

    React.useEffect(() => {
        if (isEditing) {
            offsetRef.current.style.top = 0;
            return;
        }

        const callback = () => {
            const rect = elementRef.current.getBoundingClientRect();

            if (rect.y < 0) {
                offsetRef.current.style.top = `${-1 * rect.y}px`;
            } else {
                offsetRef.current.style.top = 0;
            }
        };

        document.addEventListener('scroll', callback);

        return () => {
            document.removeEventListener('scroll', callback);
        };
    }, [isEditing, elementRef, offsetRef]);

    const controlsHeight =
        registerManager.gridLayout.rowHeight * size +
        registerManager.gridLayout.margin[0] * (size - 1);

    return (
        <div style={{height: '100%'}} ref={elementRef}>
            <div
                style={{
                    height: '100%',
                    background: '#ccc',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                }}
                ref={offsetRef}
            >
                <div style={{height: `${controlsHeight}px`, flexShrink: 0}}>
                    <button
                        onClick={() => {
                            setCollapsed(!isCollapsed);
                            setTimeout(() => {
                                onSizeUpdate(
                                    isCollapsed
                                        ? Math.min(currentMaxSizeRef.current, MAX_HEADER_SIZE)
                                        : HEADER_SIZE,
                                );
                            });
                        }}
                    >
                        Toggle Visible
                    </button>

                    <button
                        onClick={() => {
                            setEditing(!isEditing);
                            onSizeUpdate(
                                isEditing
                                    ? Math.min(currentMaxSizeRef.current, MAX_HEADER_SIZE)
                                    : currentMaxSizeRef.current,
                            );
                        }}
                    >
                        Toggle inner edit
                    </button>
                </div>

                <div
                    style={{
                        overflow: isCollapsed ? 'hidden' : isEditing ? 'visible' : 'auto',
                        maxHeight: '100%',
                        height: isCollapsed ? '0' : 'auto',
                        paddingRight: '20px',
                        flexGrow: 1,
                    }}
                >
                    <Layout
                        {...registerManager.gridLayout}
                        cols={registerManager.gridLayout.cols - 2}
                        className="layout"
                        layout={layout}
                        onLayoutChange={onLayoutUpdate}
                        onResize={onLayoutUpdate}
                        onDrag={onLayoutUpdate}
                        isDraggable={isEditing}
                        isResizable={isEditing}
                    >
                        {children({editMode: isEditing})}
                    </Layout>
                </div>
            </div>
        </div>
    );
};

export default class GridLayout extends React.PureComponent {
    constructor(props, context) {
        super(props, context);
        this.pluginsRefs = [];
        this.state = {
            isDragging: false,
            isPageHidden: false,
            fixedHeaderLayout: {
                i: FIXED_HEADER_ID,
                h: 0,
                w: context.registerManager.gridLayout.cols,
                x: 0,
                y: 0,
                isDraggable: false,
                isResizable: false,
                static: true,
                resizeHandles: [],
            },
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

    onUpdateFixed = (size) => {
        if (this.state.fixedHeaderLayout.h !== size) {
            this.setState({
                fixedHeaderLayout: {
                    ...this.state.fixedHeaderLayout,
                    h: size,
                },
            });
        }
    };

    getRenderLayout({fixedHeader} = {}) {
        const {layout, temporaryLayout, config} = this.context;
        const layoutData = temporaryLayout?.data || layout;

        if (fixedHeader) {
            const fixedMap = config.items.reduce((memo, item) => {
                if (item.fixed) {
                    memo[item.id] = item;
                }

                return memo;
            }, {});

            return layoutData.filter(({i}) => fixedMap[i]);
        }

        return [...layoutData, this.state.fixedHeaderLayout];
    }

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

    _onStop = (layoutData) => {
        const {layoutChange, layout, onDrop, temporaryLayout} = this.context;

        const layoutMap = {};
        const newLayout = layoutData.filter((item) => {
            layoutMap[item.i] = item;
            return item.i !== FIXED_HEADER_ID;
        });
        layout.forEach((item) => {
            if (!layoutMap[item.i]) {
                newLayout.push(item);
            }
        });

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
        const {editMode, dragOverPlugin, onDropDragOver} = this.context;

        if (!editMode || !dragOverPlugin) {
            return false;
        }

        return onDropDragOver(e);
    };

    _onDrop = (layout, item, e) => {
        if (!item) {
            return false;
        }

        const {editMode, onDrop} = this.context;
        if (!editMode) {
            return false;
        }

        onDrop?.(layout, item, e);
    };

    renderTemporaryPlaceholder() {
        const {temporaryLayout, noOverlay, draggableHandleClassName} = this.context;

        if (!temporaryLayout || !temporaryLayout.dragProps) {
            return null;
        }

        const id = TEMPORARY_ITEM_ID;
        const {type} = temporaryLayout.dragProps;

        return (
            <GridItem
                key={id}
                id={id}
                item={{id, type, data: {}}}
                layout={temporaryLayout.data}
                adjustWidgetLayout={this.adjustWidgetLayout}
                isDragging={this.state.isDragging}
                isPlaceholder={true}
                noOverlay={noOverlay}
                withCustomHandle={Boolean(draggableHandleClassName)}
                overlayControls={this.props.overlayControls}
            />
        );
    }

    renderItems({fixedHeader, editMode} = {}) {
        const {layout, temporaryLayout, config, noOverlay, focusable, draggableHandleClassName} =
            this.context;

        const layoutData = temporaryLayout?.data || layout;

        return config.items
            .filter((item) => (fixedHeader ? item.fixed : !item.fixed))
            .map((item, i) => {
                return (
                    <GridItem
                        editMode={editMode}
                        forwardedPluginRef={(pluginRef) => {
                            this.pluginsRefs[i] = pluginRef;
                        }} // forwarded ref to plugin
                        key={item.id}
                        id={item.id}
                        item={item}
                        layout={layoutData}
                        adjustWidgetLayout={this.adjustWidgetLayout}
                        isDragging={this.state.isDragging}
                        noOverlay={noOverlay}
                        focusable={focusable}
                        withCustomHandle={Boolean(draggableHandleClassName)}
                        overlayControls={this.props.overlayControls}
                    />
                );
            });
    }

    renderFixedBlock() {
        const {registerManager, editMode} = this.context;

        return (
            <div key={FIXED_HEADER_ID} style={{zIndex: 20}}>
                <FixedHeader
                    layout={this.getRenderLayout({fixedHeader: true})}
                    onSizeUpdate={this.onUpdateFixed}
                    editMode={editMode}
                    registerManager={registerManager}
                    size={HEADER_SIZE}
                >
                    {({editMode}) => this.renderItems({fixedHeader: true, editMode})}
                </FixedHeader>
            </div>
        );
    }

    render() {
        const {config, registerManager, editMode, draggableHandleClassName, outerDnDEnable} =
            this.context;
        this.pluginsRefs.length = config.items.length;
        const layout = this.getRenderLayout();

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
                {...(outerDnDEnable
                    ? {
                          isDroppable: true,
                          onDropDragOver: this._onDropDragOver,
                          onDrop: this._onDrop,
                      }
                    : null)}
                draggableCancel={`.${OVERLAY_CONTROLS_CLASS_NAME}`}
            >
                {this.renderFixedBlock()}
                {this.renderItems()}
                {this.renderTemporaryPlaceholder()}
            </Layout>
        );
    }
}
