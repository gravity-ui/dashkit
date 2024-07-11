import React from 'react';

import {
    COMPACT_TYPE_HORIZONTAL_NOWRAP,
    DEFAULT_GROUP,
    OVERLAY_CONTROLS_CLASS_NAME,
    TEMPORARY_ITEM_ID,
} from '../../constants';
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

        this._memoCallbacksForGroups = {};
        this._memoGroupsProps = {};
        this._memoGroupsLayouts = {};
        this._memoForwardedPluginRef = [];
    }

    static contextType = DashKitContext;

    _memoForwardedPluginRef = [];
    _memoGroupsProps = {};
    _memoGroupsLayouts = {};
    _memoCallbacksForGroups = {};

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

    getActiveLayout() {
        const {layout, temporaryLayout} = this.context;

        return temporaryLayout?.data || layout;
    }

    getMemoGroupLayout = (group, layout) => {
        // fastest possible way to match json
        const key = JSON.stringify(layout);

        if (this._memoGroupsLayouts[group]) {
            if (this._memoGroupsLayouts[group].key === key) {
                return this._memoGroupsLayouts[group];
            } else {
                this._memoGroupsLayouts[group].key = key;
                this._memoGroupsLayouts[group].layout = layout;
            }
        } else {
            this._memoGroupsLayouts[group] = {
                key,
                layout,
            };
        }

        return this._memoGroupsLayouts[group];
    };

    getMemoGroupCallbacks = (group) => {
        if (!this._memoCallbacksForGroups[group]) {
            const onStart = this._onStart;
            const onStop = this._onStop.bind(this, group);
            const onDrop = this._onDrop.bind(this, group);
            const onDropDragOver = this._onDropDragOver.bind(this, group);

            this._memoCallbacksForGroups[group] = {
                onDragStart: onStart,
                onResizeStart: onStart,
                onDragStop: onStop,
                onResizeStop: onStop,
                onDrop: onDrop,
                onDropDragOver,
            };
        }

        return this._memoCallbacksForGroups[group];
    };

    getMemoGroupProps = (group, renderLayout, properties) => {
        // Needed for _onDropDragOver
        this._memoGroupsProps[group] = properties;

        return {
            layout: this.getMemoGroupLayout(group, renderLayout).layout,
            callbacks: this.getMemoGroupCallbacks(group),
        };
    };

    getLayoutAndPropsByGroup = (group) => {
        return {
            properties: this._memoGroupsProps[group],
            layout: this._memoGroupsLayouts[group].layout,
        };
    };

    getMemoForwardRefCallback = (refIndex) => {
        if (!this._memoForwardedPluginRef[refIndex]) {
            this._memoForwardedPluginRef[refIndex] = (pluginRef) => {
                this.pluginsRefs[refIndex] = pluginRef;
            };
        }

        return this._memoForwardedPluginRef[refIndex];
    };

    mergeGroupsLayout(group, newLayout, temporaryItem) {
        const renderLayout = this.getActiveLayout();
        const itemsByGroup = renderLayout.reduce(
            (memo, item) => {
                memo[item.i] = item;
                return memo;
            },
            temporaryItem ? {[temporaryItem.i]: temporaryItem} : {},
        );

        const newItemsLayoutById = newLayout.reduce((memo, item) => {
            const parent = itemsByGroup[item.i].parent;
            memo[item.i] = {...item, parent};
            return memo;
        }, {});

        return renderLayout.map((currentItem) => {
            const itemParent = itemsByGroup[currentItem.i].parent || DEFAULT_GROUP;

            if (itemParent === group) {
                return newItemsLayoutById[currentItem.i];
            }

            return currentItem;
        });
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

    _onStop = (group, newLayout) => {
        const {layoutChange, onDrop, temporaryLayout} = this.context;
        const groupedLayout = this.mergeGroupsLayout(group, newLayout);

        if (temporaryLayout) {
            onDrop?.(
                groupedLayout,
                groupedLayout.find(({i}) => i === TEMPORARY_ITEM_ID),
            );
        } else {
            layoutChange(groupedLayout);
        }
        this.setState({isDragging: false});
    };

    _onDropDragOver = (group, e) => {
        const {editMode, dragOverPlugin} = this.context;

        if (!editMode || !dragOverPlugin) {
            return false;
        }

        const {properties, layout} = this.getLayoutAndPropsByGroup(group);

        return this.context.onDropDragOver(e, properties, layout);
    };

    _onDrop = (group, newLayout, item, e) => {
        if (!item) {
            return false;
        }

        const {editMode, onDrop} = this.context;
        if (!editMode) {
            return false;
        }

        if (group !== DEFAULT_GROUP) {
            item.parent = group;
        }

        const groupedLayout = this.mergeGroupsLayout(group, newLayout, item);

        onDrop?.(groupedLayout, item, e);
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

    renderGroup(group, renderLayout, renderItems, offset = 0, groupGridProperties) {
        const {
            registerManager,
            editMode,
            noOverlay,
            focusable,
            draggableHandleClassName,
            outerDnDEnable,
        } = this.context;

        const properties = groupGridProperties
            ? groupGridProperties({
                  ...registerManager.gridLayout,
              })
            : registerManager.gridLayout;
        let {compactType} = properties;

        if (compactType === COMPACT_TYPE_HORIZONTAL_NOWRAP) {
            compactType = 'horizontal';
        }

        const {callbacks, layout} = this.getMemoGroupProps(group, renderLayout, properties);

        return (
            <Layout
                {...properties}
                compactType={compactType}
                layout={layout}
                key={`group_${group}`}
                isDraggable={editMode}
                isResizable={editMode}
                onDragStart={callbacks.onDragStart}
                onDragStop={callbacks.onDragStop}
                onResizeStart={callbacks.onResizeStart}
                onResizeStop={callbacks.onResizeStop}
                {...(draggableHandleClassName
                    ? {draggableHandle: `.${draggableHandleClassName}`}
                    : null)}
                {...(outerDnDEnable
                    ? {
                          isDroppable: true,
                          onDropDragOver: callbacks.onDropDragOver,
                          onDrop: callbacks.onDrop,
                      }
                    : null)}
                draggableCancel={`.${OVERLAY_CONTROLS_CLASS_NAME}`}
            >
                {renderItems.map((item, i) => {
                    return (
                        <GridItem
                            forwardedPluginRef={this.getMemoForwardRefCallback(offset + i)} // forwarded ref to plugin
                            key={item.id}
                            id={item.id}
                            item={item}
                            layout={layout}
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

    render() {
        const {config, groups, editMode} = this.context;

        this.pluginsRefs.length = config.items.length;

        const defaultRenderLayout = [];
        const defaultRenderItems = [];
        const layoutMap = {};

        const groupedLayout = this.getActiveLayout().reduce((memo, item) => {
            if (item.parent) {
                if (!memo[item.parent]) {
                    memo[item.parent] = [];
                }

                memo[item.parent].push(item);
                layoutMap[item.i] = item.parent;
            } else {
                defaultRenderLayout.push(item);
            }

            return memo;
        }, []);

        const itemsByGroup = config.items.reduce((memo, item) => {
            const group = layoutMap[item.id];
            if (group) {
                if (!memo[group]) {
                    memo[group] = [];
                }
                memo[group].push(item);
            } else {
                defaultRenderItems.push(item);
            }

            return memo;
        }, {});

        let offset = 0;

        if (groups) {
            return groups.map((group) => {
                const id = group.id || DEFAULT_GROUP;

                let layout, items;

                if (id === DEFAULT_GROUP) {
                    layout = defaultRenderLayout;
                    items = defaultRenderItems;
                } else {
                    layout = groupedLayout[id] || [];
                    items = itemsByGroup[id] || [];
                }

                const element = this.renderGroup(id, layout, items, offset, group.gridProperties);
                offset += items.length;

                if (group.render) {
                    return group.render(id, element, {
                        config,
                        editMode,
                        items,
                        layout,
                    });
                }

                return element;
            });
        } else {
            return this.renderGroup(DEFAULT_GROUP, defaultRenderLayout, defaultRenderItems, offset);
        }
    }
}
