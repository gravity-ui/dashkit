import React from 'react';

import {
    COMPACT_TYPE_HORIZONTAL_NOWRAP,
    DEFAULT_GROUP,
    DRAGGABLE_CANCEL_CLASS_NAME,
    TEMPORARY_ITEM_ID,
} from '../../constants';
import {DashKitContext} from '../../context/DashKitContext';
import {resolveLayoutGroup} from '../../utils';
import GridItem from '../GridItem/GridItem';

import {Layout} from './ReactGridLayout';

export default class GridLayout extends React.PureComponent {
    constructor(props, context) {
        super(props, context);
        this.pluginsRefs = [];
        this.state = {
            isDragging: false,
            isPageHidden: false,
            currentDraggingElement: null,
            draggedOverGroup: null,
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

    getMemoGroupLayout(group, layout) {
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
    }

    getMemoGroupCallbacks(group) {
        if (!this._memoCallbacksForGroups[group]) {
            const onDragStart = this._onDragStart.bind(this, group);
            const onDrag = this._onDrag.bind(this, group);
            const onDragStop = this._onDragStop.bind(this, group);

            const onResizeStart = this._onResizeStart.bind(this, group);
            const onResize = this._onResize.bind(this, group);
            const onResizeStop = this._onResizeStop.bind(this, group);

            const onDrop = this._onDrop.bind(this, group);
            const onDropDragOver = this._onDropDragOver.bind(this, group);
            const onDragTargetRestore = this._onTargetRestore.bind(this, group);

            this._memoCallbacksForGroups[group] = {
                onDragStart,
                onDrag,
                onDragStop,
                onResizeStart,
                onResize,
                onResizeStop,
                onDrop,
                onDropDragOver,
                onDragTargetRestore,
            };
        }

        return this._memoCallbacksForGroups[group];
    }

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
            memo[item.i] = {...item};

            if (parent) {
                memo[item.i].parent = parent;
            }
            return memo;
        }, {});

        return renderLayout.map((currentItem) => {
            const itemParent = resolveLayoutGroup(itemsByGroup[currentItem.i]);

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

    prepareDefaultArguments(group, layout, oldItem, newItem, placeholder, e, element) {
        return {
            group,
            layout,
            oldItem,
            newItem,
            placeholder,
            e,
            element,
        };
    }

    updateeDraggingElementState(group, layoutItem, e) {
        let currentDraggingElement = this.state.currentDraggingElement;

        if (!currentDraggingElement) {
            const {temporaryLayout} = this.context;
            const layoutId = layoutItem.i;

            const item = temporaryLayout
                ? temporaryLayout.dragProps
                : this.context.config.items.find(({id}) => id === layoutId);
            const {offsetX, offsetY} = e.nativeEvent;

            currentDraggingElement = {
                group,
                layoutItem,
                item,
                cursorPosition: {offsetX, offsetY},
            };
        }

        this.setState({currentDraggingElement, draggedOverGroup: group});
    }

    _onDragStart(group, _newLayout, layoutItem, _newItem, _placeholder, e, element) {
        this.context.onDragStart?.call(
            this,
            this.prepareDefaultArguments(
                group,
                _newLayout,
                layoutItem,
                _newItem,
                _placeholder,
                e,
                element,
            ),
        );

        if (this.context.dragOverPlugin) {
            this.setState({isDragging: true});
        } else {
            this.updateeDraggingElementState(group, layoutItem, e);
            this.setState({isDragging: true});
        }
    }

    _onDrag(group, layout, oldItem, newItem, placeholder, e, element) {
        this.context.onDrag?.call(
            this,
            this.prepareDefaultArguments(group, layout, oldItem, newItem, placeholder, e, element),
        );
    }

    _onDragStop(group, layout, oldItem, newItem, placeholder, e, element) {
        this._onStop(group, layout);

        this.context.onDragStop?.call(
            this,
            this.prepareDefaultArguments(group, layout, oldItem, newItem, placeholder, e, element),
        );
    }

    _onResizeStart(group, layout, oldItem, newItem, placeholder, e, element) {
        this.setState({
            isDragging: true,
        });

        this.context.onResizeStart?.call(
            this,
            this.prepareDefaultArguments(group, layout, oldItem, newItem, placeholder, e, element),
        );
    }

    _onResize(group, layout, oldItem, newItem, placeholder, e, element) {
        this.context.onResize?.call(
            this,
            this.prepareDefaultArguments(group, layout, oldItem, newItem, placeholder, e, element),
        );
    }

    _onResizeStop(group, layout, oldItem, newItem, placeholder, e, element) {
        this.context.onResizeStop?.call(
            this,
            this.prepareDefaultArguments(group, layout, oldItem, newItem, placeholder, e, element),
        );
    }

    _onTargetRestore() {
        if (this.context.temporaryLayout) {
            return;
        }

        const {currentDraggingElement} = this.state;

        if (currentDraggingElement) {
            this.setState({
                draggedOverGroup: currentDraggingElement.group,
            });
        }
    }

    _onStop = (group, newLayout) => {
        const {layoutChange, onDrop, temporaryLayout} = this.context;
        const {draggedOverGroup, currentDraggingElement} = this.state;

        if (
            currentDraggingElement &&
            draggedOverGroup !== null &&
            draggedOverGroup !== currentDraggingElement.group
        ) {
            // Skipping layout update when change event called for source grid
            // and waiting _onDrop
            return;
        }

        const groupedLayout = this.mergeGroupsLayout(group, newLayout);

        this.setState({
            isDragging: false,
            currentDraggingElement: null,
            draggedOverGroup: null,
        });

        if (temporaryLayout) {
            onDrop?.(
                groupedLayout,
                groupedLayout.find(({i}) => i === TEMPORARY_ITEM_ID),
            );
        } else {
            layoutChange(groupedLayout);
        }
    };

    _onSharedDrop = (targetGroup, newLayout, tempItem) => {
        const {currentDraggingElement} = this.state;
        const {layoutChange} = this.context;

        if (!currentDraggingElement) {
            return;
        }

        const sourceLayoutItem = currentDraggingElement.layoutItem;

        const groupedLayout = this.mergeGroupsLayout(targetGroup, newLayout, tempItem).map(
            (item) => {
                if (item.i === sourceLayoutItem.i) {
                    const copy = {...tempItem};

                    delete copy.parent;
                    if (targetGroup !== DEFAULT_GROUP) {
                        copy.parent = targetGroup;
                    }
                    copy.i = sourceLayoutItem.i;

                    return copy;
                }

                return item;
            },
        );

        this.setState({
            isDragging: false,
            currentDraggingElement: null,
            draggedOverGroup: null,
        });

        // TODO temporaryLayout
        layoutChange(groupedLayout);
    };

    _onExternalDrop = (group, newLayout, item, e) => {
        const {onDrop} = this.context;

        if (group !== DEFAULT_GROUP) {
            item.parent = group;
        }

        const groupedLayout = this.mergeGroupsLayout(group, newLayout, item);
        this.setState({isDragging: false});

        onDrop?.(groupedLayout, item, e);
    };

    _onDrop = (group, newLayout, item, e) => {
        if (!item || !this.context.editMode) {
            return false;
        }

        const {draggedOverGroup, currentDraggingElement} = this.state;
        if (currentDraggingElement && draggedOverGroup === group) {
            this._onSharedDrop(group, newLayout, item);
        } else {
            this._onExternalDrop(group, newLayout, item, e);
        }
    };

    _onDropDragOver = (group, e) => {
        const {editMode, dragOverPlugin, onDropDragOver, temporaryLayout} = this.context;
        const {currentDraggingElement} = this.state;

        // TODO If temporary item is trying to change group
        if (temporaryLayout && currentDraggingElement) {
            return false;
        }

        if (!editMode || (!dragOverPlugin && !currentDraggingElement)) {
            return false;
        }

        const {properties, layout} = this.getLayoutAndPropsByGroup(group);

        if (currentDraggingElement) {
            const {h, w, i} = currentDraggingElement.layoutItem;
            const {type} = currentDraggingElement.item;

            return onDropDragOver(e, properties, layout, {h, w, i, type});
        }

        if (dragOverPlugin) {
            return onDropDragOver(e, properties, layout);
        }

        return false;
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
            onItemMountChange,
            onItemRender,
        } = this.context;

        const {currentDraggingElement, draggedOverGroup} = this.state;

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
        const hasSharedDragItem = Boolean(
            currentDraggingElement && currentDraggingElement.group !== group,
        );
        const isDragCaptured =
            currentDraggingElement &&
            group === currentDraggingElement.group &&
            draggedOverGroup !== null &&
            draggedOverGroup !== group;

        return (
            <Layout
                // Group properties
                {...properties}
                // Layout props
                compactType={compactType}
                layout={layout}
                key={`group_${group}`}
                isDraggable={editMode}
                isResizable={editMode}
                draggableCancel={`.${DRAGGABLE_CANCEL_CLASS_NAME}`}
                {...(draggableHandleClassName
                    ? {draggableHandle: `.${draggableHandleClassName}`}
                    : null)}
                // Default callbacks
                onDragStart={callbacks.onDragStart}
                onDrag={callbacks.onDrag}
                onDragStop={callbacks.onDragStop}
                onResizeStart={callbacks.onResizeStart}
                onResize={callbacks.onResize}
                onResizeStop={callbacks.onResizeStop}
                // External Drag N Drop options
                onDragTargetRestore={callbacks.onDragTargetRestore}
                onDropDragOver={callbacks.onDropDragOver}
                onDrop={callbacks.onDrop}
                hasSharedDragItem={hasSharedDragItem}
                sharedDragPosition={currentDraggingElement?.cursorPosition}
                isDragCaptured={isDragCaptured}
                {...(outerDnDEnable
                    ? {
                          isDroppable: true,
                      }
                    : null)}
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
                            onItemMountChange={onItemMountChange}
                            onItemRender={onItemRender}
                        />
                    );
                })}
                {this.renderTemporaryPlaceholder()}
            </Layout>
        );
    }

    render() {
        const {config, groups, editMode, context} = this.context;

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
                        context,
                    });
                }

                return element;
            });
        } else {
            return this.renderGroup(DEFAULT_GROUP, defaultRenderLayout, defaultRenderItems, offset);
        }
    }
}
