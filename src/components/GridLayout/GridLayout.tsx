import React from 'react';

import type {DragOverEvent} from 'react-grid-layout';

import type {PluginRef, ReactGridLayoutProps} from 'src/typings';

import {
    COMPACT_TYPE_HORIZONTAL_NOWRAP,
    DEFAULT_GROUP,
    DRAGGABLE_CANCEL_CLASS_NAME,
    TEMPORARY_ITEM_ID,
} from '../../constants';
import {DashKitContext} from '../../context';
import type {DashKitCtxShape} from '../../context';
import type {ConfigItem, ConfigLayout, DraggedOverItem} from '../../shared';
import {resolveLayoutGroup} from '../../utils';
import GridItem from '../GridItem/GridItem';

import {Layout} from './ReactGridLayout';
import type {
    AdjustWidgetLayoutParams,
    CurrentDraggingElement,
    GridLayoutProps,
    GridLayoutState,
    GroupCallbacks,
    LayoutAndPropsByGroup,
    ManipulationCallbackArgs,
    MemoGroupLayout,
    ReloadItemsOptions,
} from './types';

const hasPluginId = (value: PluginRef): value is {props: {id: string}} => {
    return (
        value !== null &&
        'props' in value &&
        typeof value.props === 'object' &&
        value.props !== null &&
        'id' in value.props &&
        typeof value.props.id === 'string'
    );
};

export default class GridLayout extends React.PureComponent<GridLayoutProps, GridLayoutState> {
    static contextType = DashKitContext;
    context!: DashKitCtxShape;

    pluginsRefs: Array<PluginRef>;

    private _memoForwardedPluginRef: Array<(pluginRef: PluginRef) => void> = [];
    private _memoGroupsProps: Record<string, Partial<ReactGridLayoutProps>> = {};
    private _memoGroupsLayouts: Record<string, MemoGroupLayout> = {};
    private _memoCallbacksForGroups: Record<string, GroupCallbacks> = {};

    private _timeout?: NodeJS.Timeout;
    private _lastReloadAt?: number;
    private _parendDragNode: HTMLElement | null = null;

    constructor(props: GridLayoutProps, context: DashKitCtxShape) {
        super(props, context);
        this.pluginsRefs = [];
        this.state = {
            isDragging: false,
            isDraggedOut: false,
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

    onVisibilityChange = () => {
        this.setState({
            isPageHidden: document.hidden,
        });
    };

    adjustWidgetLayout = ({
        widgetId,
        needSetDefault,
        adjustedWidgetLayout,
    }: AdjustWidgetLayoutParams) => {
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

    getActiveLayout(): ConfigLayout[] {
        const {layout, temporaryLayout} = this.context;

        return temporaryLayout?.data || layout;
    }

    getMemoGroupLayout(group: string, layout: ConfigLayout[]): MemoGroupLayout {
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

    getMemoGroupCallbacks(group: string): GroupCallbacks {
        if (!this._memoCallbacksForGroups[group]) {
            const onDragStart = this._onDragStart.bind(this, group);
            const onDrag = this._onDrag.bind(this, group);
            const onDragStop = this._onDragStop.bind(this, group);

            const onResizeStart = this._onResizeStart.bind(this, group);
            const onResize = this._onResize.bind(this, group);
            const onResizeStop = this._onResizeStop.bind(this, group);

            const onDrop = this._onDrop.bind(this, group);
            const onDropDragOver = this._onDropDragOver.bind(this, group);
            const onDragTargetRestore = this._onTargetRestore.bind(this);

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

    getMemoGroupProps = (
        group: string,
        renderLayout: ConfigLayout[],
        properties: Partial<ReactGridLayoutProps>,
    ) => {
        // Needed for _onDropDragOver
        this._memoGroupsProps[group] = properties;

        return {
            layout: this.getMemoGroupLayout(group, renderLayout).layout,
            callbacks: this.getMemoGroupCallbacks(group),
        };
    };

    getLayoutAndPropsByGroup = (group: string): LayoutAndPropsByGroup => {
        return {
            properties: this._memoGroupsProps[group],
            layout: this._memoGroupsLayouts[group].layout,
        };
    };

    getMemoForwardRefCallback = (refIndex: number) => {
        if (!this._memoForwardedPluginRef[refIndex]) {
            this._memoForwardedPluginRef[refIndex] = (pluginRef: PluginRef) => {
                this.pluginsRefs[refIndex] = pluginRef;
            };
        }

        return this._memoForwardedPluginRef[refIndex];
    };

    mergeGroupsLayout(
        group: string,
        newLayout: ConfigLayout[],
        temporaryItem?: ConfigLayout,
    ): ConfigLayout[] {
        const renderLayout = this.getActiveLayout();
        const itemsByGroup = renderLayout.reduce<Record<string, ConfigLayout>>(
            (memo, item) => {
                memo[item.i] = item;
                return memo;
            },
            temporaryItem ? {[temporaryItem.i]: temporaryItem} : {},
        );

        const newItemsLayoutById = newLayout.reduce<Record<string, ConfigLayout>>((memo, item) => {
            const parent = itemsByGroup[item.i]?.parent;
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

    reloadItems(options?: ReloadItemsOptions) {
        const {targetIds, force} = options || {};

        const {
            editMode,
            settings: {autoupdateInterval, silentLoading} = {},
            reloadItems,
        } = this.context;

        const {isPageHidden} = this.state;

        const autoupdateIntervalMs = Number(autoupdateInterval) * 1000;

        const targetPlugins = targetIds
            ? this.pluginsRefs.filter(
                  (plugin) => hasPluginId(plugin) && targetIds.includes(plugin.props.id),
              )
            : this.pluginsRefs;

        if (autoupdateIntervalMs) {
            const timeSinceLastReload = new Date().getTime() - (this._lastReloadAt || 0);
            const reloadIntervalRemains = autoupdateIntervalMs - timeSinceLastReload;

            if (force || (!isPageHidden && !editMode && reloadIntervalRemains <= 0)) {
                this._lastReloadAt = new Date().getTime();
                reloadItems(targetPlugins, {silentLoading: Boolean(silentLoading), noVeil: true});
            }

            this._timeout = setTimeout(
                () => this.reloadItems(),
                reloadIntervalRemains <= 0 ? autoupdateIntervalMs : reloadIntervalRemains,
            );
        } else if (force) {
            reloadItems(targetPlugins, {silentLoading: Boolean(silentLoading), noVeil: true});
        }
    }

    prepareDefaultArguments(
        group: string,
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ): ManipulationCallbackArgs {
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

    updateDraggingElementState(group: string, layoutItem: ConfigLayout, e: MouseEvent) {
        let currentDraggingElement: CurrentDraggingElement | null =
            this.state.currentDraggingElement;

        if (!currentDraggingElement) {
            const {temporaryLayout} = this.context;
            const layoutId = layoutItem.i;

            const item = temporaryLayout
                ? temporaryLayout.dragProps
                : this.context.configItems.find(({id}) => id === layoutId);

            if (!item) {
                return;
            }

            let {offsetX, offsetY} =
                (e as MouseEvent & {nativeEvent?: MouseEvent}).nativeEvent || {};
            if (offsetX === undefined || offsetY === undefined) {
                const target = e.currentTarget as HTMLElement;
                const gridRect = target?.getBoundingClientRect();

                offsetX = e.clientX - (gridRect?.left || 0);
                offsetY = e.clientY - (gridRect?.top || 0);
            }

            currentDraggingElement = {
                group,
                layoutItem,
                item,
                cursorPosition: {offsetX, offsetY},
            };
        }

        this.setState({currentDraggingElement, draggedOverGroup: group});
    }

    _initDragCoordinatesWatcher(element: HTMLElement) {
        if (!this._parendDragNode) {
            this._parendDragNode = element.parentElement;
            this.setState({isDraggedOut: false});
        }
    }

    // When element is going back and prointer-event: none is removed mouse enter event is not fired
    // So to trigger it we are forcing this event by adding transparent block under the mouse
    _forceCursorCapture(
        parentElement: HTMLElement,
        position: {top: number; left: number},
        parentRect: DOMRect,
    ) {
        const block = document.createElement('div');
        block.classList.add('react-grid-focus-capture');

        const blockSize = 44;
        const offset = blockSize / 2;

        // Keeping elemnt inside current grid
        const top = Math.min(Math.max(position.top - offset, 0), parentRect.height - blockSize);
        const left = Math.min(Math.max(position.left - offset, 0), parentRect.width - blockSize);

        block.style.width = `${blockSize}px`;
        block.style.height = `${blockSize}px`;
        block.style.top = `${top}px`;
        block.style.left = `${left}px`;

        parentElement.appendChild(block);

        setTimeout(() => {
            block.remove();
        }, 100);
    }

    _updateDragCoordinates(e: MouseEvent) {
        const parent = this._parendDragNode;

        if (!parent) {
            return;
        }

        const parentRect = parent.getBoundingClientRect();
        const {clientX, clientY} = e;

        let isDraggedOut = this.state.isDraggedOut;
        if (
            clientX < parentRect.left ||
            clientX > parentRect.right ||
            clientY < parentRect.top ||
            clientY > parentRect.bottom
        ) {
            isDraggedOut = true;
        } else {
            isDraggedOut = false;
        }

        if (isDraggedOut !== this.state.isDraggedOut) {
            this.setState({isDraggedOut});

            if (!isDraggedOut) {
                this._forceCursorCapture(
                    parent,
                    {
                        top: clientY - parentRect.top,
                        left: clientX - parentRect.left,
                    },
                    parentRect,
                );
            }
        }
    }

    _resetDragWatcher() {
        this._parendDragNode = null;
        this.setState({isDraggedOut: false});
    }

    _onDragStart(
        group: string,
        _newLayout: ConfigLayout[],
        layoutItem: ConfigLayout,
        _newItem: ConfigLayout,
        _placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) {
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
            this._initDragCoordinatesWatcher(element);
            this.updateDraggingElementState(group, layoutItem, e);
            this.setState({isDragging: true});
        }
    }

    _onDrag(
        group: string,
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) {
        if (!this.context.dragOverPlugin) {
            this._updateDragCoordinates(e);
        }

        this.context.onDrag?.call(
            this,
            this.prepareDefaultArguments(group, layout, oldItem, newItem, placeholder, e, element),
        );
    }

    _onDragStop(
        group: string,
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) {
        this._resetDragWatcher();

        this._onStop(group, layout);

        this.context.onDragStop?.call(
            this,
            this.prepareDefaultArguments(group, layout, oldItem, newItem, placeholder, e, element),
        );
    }

    _onResizeStart(
        group: string,
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) {
        this.setState({
            isDragging: true,
        });

        this.context.onResizeStart?.call(
            this,
            this.prepareDefaultArguments(group, layout, oldItem, newItem, placeholder, e, element),
        );
    }

    _onResize(
        group: string,
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) {
        this.context.onResize?.call(
            this,
            this.prepareDefaultArguments(group, layout, oldItem, newItem, placeholder, e, element),
        );
    }

    _onResizeStop(
        group: string,
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) {
        this._onStop(group, layout);

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

    _onStop = (group: string, newLayout: ConfigLayout[]) => {
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
            const temporaryItem = groupedLayout.find(({i}) => i === TEMPORARY_ITEM_ID);
            if (onDrop && temporaryItem) {
                onDrop(groupedLayout, temporaryItem);
            }
        } else {
            layoutChange(groupedLayout);
        }
    };

    _onSharedDrop = (targetGroup: string, newLayout: ConfigLayout[], tempItem: ConfigLayout) => {
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

    _onExternalDrop = (
        group: string,
        newLayout: ConfigLayout[],
        item: ConfigLayout,
        e: MouseEvent,
    ) => {
        const {onDrop} = this.context;

        if (group !== DEFAULT_GROUP) {
            item.parent = group;
        }

        const groupedLayout = this.mergeGroupsLayout(group, newLayout, item);
        this.setState({isDragging: false});

        onDrop?.(groupedLayout, item, e);
    };

    _onDrop = (
        group: string,
        newLayout: ConfigLayout[],
        item: ConfigLayout | undefined,
        e: MouseEvent,
    ): void | false => {
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

    _onDropDragOver = (
        group: string,
        e: DragOverEvent,
    ): {w?: number; h?: number} | false | undefined => {
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
            const sharedItem: DraggedOverItem = {
                h,
                w,
                i,
                type,
                parent: currentDraggingElement.group,
            };

            return onDropDragOver(e, group, properties, layout, sharedItem);
        }

        if (dragOverPlugin) {
            return onDropDragOver(e, group, properties, layout);
        }

        return false;
    };

    renderTemporaryPlaceholder(gridLayout: Partial<ReactGridLayoutProps>) {
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
                item={{id, type, data: {}} as ConfigItem}
                layout={temporaryLayout.data}
                adjustWidgetLayout={this.adjustWidgetLayout}
                isDragging={this.state.isDragging}
                isPlaceholder={true}
                noOverlay={noOverlay}
                withCustomHandle={Boolean(draggableHandleClassName)}
                gridLayout={gridLayout}
            />
        );
    }

    renderGroup(
        group: string,
        renderLayout: ConfigLayout[],
        renderItems: ConfigItem[],
        offset = 0,
        groupGridProperties?: (props: ReactGridLayoutProps) => ReactGridLayoutProps,
    ) {
        const {
            registerManager,
            editMode,
            noOverlay,
            focusable,
            draggableHandleClassName,
            outerDnDEnable,
            onItemMountChange,
            onItemRender,
            onItemFocus,
            onItemBlur,
        } = this.context;

        const {currentDraggingElement, draggedOverGroup} = this.state;
        const hasOwnGroupProperties = typeof groupGridProperties === 'function';
        const properties = hasOwnGroupProperties
            ? groupGridProperties({...registerManager.gridLayout})
            : registerManager.gridLayout;
        let {compactType} = properties;

        if (compactType === COMPACT_TYPE_HORIZONTAL_NOWRAP) {
            compactType = 'horizontal';
        }

        const {callbacks, layout} = this.getMemoGroupProps(group, renderLayout, properties);
        const hasSharedDragItem = Boolean(
            currentDraggingElement && currentDraggingElement.group !== group,
        );
        const isDragCaptured = Boolean(
            currentDraggingElement &&
                group === currentDraggingElement.group &&
                draggedOverGroup !== null &&
                draggedOverGroup !== group,
        );

        return (
            <Layout
                key={`group_${group}`}
                isDraggable={editMode}
                isResizable={editMode}
                // Group properties
                {...properties}
                // Layout props
                compactType={compactType}
                layout={layout}
                draggableCancel={`.${DRAGGABLE_CANCEL_CLASS_NAME}`}
                draggableHandle={
                    draggableHandleClassName ? `.${draggableHandleClassName}` : undefined
                }
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
                isDroppable={Boolean(outerDnDEnable) && editMode}
            >
                {renderItems.map((item, i) => {
                    const keyId = item.id;
                    const isDragging = this.state.isDragging;
                    const isCurrentDraggedItem =
                        currentDraggingElement &&
                        'id' in currentDraggingElement.item &&
                        currentDraggingElement.item.id === keyId;
                    const isDraggedOut = isCurrentDraggedItem && this.state.isDraggedOut;
                    const itemNoOverlay =
                        hasOwnGroupProperties && 'noOverlay' in properties
                            ? properties.noOverlay
                            : noOverlay;

                    return (
                        <GridItem
                            key={keyId}
                            forwardedPluginRef={this.getMemoForwardRefCallback(offset + i)} // forwarded ref to plugin
                            id={keyId}
                            item={item}
                            layout={layout}
                            adjustWidgetLayout={this.adjustWidgetLayout}
                            isDragging={isDragging}
                            isDraggedOut={isDraggedOut || undefined}
                            noOverlay={itemNoOverlay}
                            focusable={focusable}
                            withCustomHandle={Boolean(draggableHandleClassName)}
                            onItemMountChange={onItemMountChange}
                            onItemRender={onItemRender}
                            gridLayout={properties}
                            onItemFocus={onItemFocus}
                            onItemBlur={onItemBlur}
                        />
                    );
                })}
                {this.renderTemporaryPlaceholder(properties)}
            </Layout>
        );
    }

    render() {
        const {config, groups, editMode, context} = this.context;

        this.pluginsRefs.length = this.context.configItems.length;

        const defaultRenderLayout: ConfigLayout[] = [];
        const defaultRenderItems: ConfigItem[] = [];
        const layoutMap: Record<string, string> = {};

        const groupedLayout = this.getActiveLayout().reduce<Record<string, ConfigLayout[]>>(
            (memo, item) => {
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
            },
            {},
        );

        const itemsByGroup = this.context.configItems.reduce<Record<string, ConfigItem[]>>(
            (memo, item) => {
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
            },
            {},
        );

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
                    const groupContext = {
                        isMobile: false,
                        config,
                        editMode,
                        items,
                        layout,
                        context,
                    };
                    return group.render(id, element, groupContext);
                }

                return element;
            });
        } else {
            return this.renderGroup(DEFAULT_GROUP, defaultRenderLayout, defaultRenderItems, offset);
        }
    }
}
