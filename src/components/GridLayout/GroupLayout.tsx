import React from 'react';

import {DRAGGABLE_CANCEL_CLASS_NAME} from '../../constants';
import {DashKitContext} from '../../context';
import type {ConfigItem, ConfigLayout} from '../../shared';
import type {PluginRef, PluginWidgetProps, ReactGridLayoutProps} from '../../typings';
import GridItem from '../GridItem/GridItem';

import {Layout} from './ReactGridLayout';
import type {GroupCallbacks} from './types';
import {shallowArrayEqual, shallowObjectEqual} from './utils';

export interface GroupLayoutProps {
    group: string;
    renderItems: ConfigItem[];
    offset: number;

    // Pre-computed by GridLayout.renderGroup (stable refs via getMemoGroupProps)
    properties: Partial<ReactGridLayoutProps>;
    compactType: 'vertical' | 'horizontal' | null | undefined;
    callbacks: GroupCallbacks;
    layout: ConfigLayout[];
    temporaryPlaceholder: React.ReactNode;

    // Refs read imperatively by DragOverLayout — no re-render on drag start.
    isDragCaptured: boolean;
    dragStateRef: React.MutableRefObject<{isDragging: boolean; sourceGroup: string | null}>;
    sharedDragPositionRef: React.MutableRefObject<{offsetX: number; offsetY: number} | null>;

    // Drag state scoped to this group only (always false/null for non-source groups)
    isAnyDragging: boolean;
    currentDraggingItemId: string | null;
    isAnyDraggedOut: boolean;

    // Stable instance method refs from GridLayout (arrow function class properties)
    adjustWidgetLayout: PluginWidgetProps['adjustWidgetLayout'];
    getMemoForwardRefCallback: (index: number) => (ref: PluginRef) => void;
}

function groupLayoutPropsAreEqual(prev: GroupLayoutProps, next: GroupLayoutProps): boolean {
    const needRerenderIfChanged =
        prev.group !== next.group ||
        prev.layout !== next.layout ||
        prev.offset !== next.offset ||
        !shallowArrayEqual(prev.renderItems, next.renderItems) ||
        !shallowObjectEqual(prev.properties, next.properties);

    // Drag refs are stable and never trigger re-renders; only group-scoped state matters.
    const needRerenderGroupScoped =
        prev.isDragCaptured !== next.isDragCaptured ||
        prev.isAnyDragging !== next.isAnyDragging ||
        prev.currentDraggingItemId !== next.currentDraggingItemId ||
        prev.isAnyDraggedOut !== next.isAnyDraggedOut;

    const hasTmpPlaceholderChanged = prev.temporaryPlaceholder !== next.temporaryPlaceholder;

    return !needRerenderIfChanged && !needRerenderGroupScoped && !hasTmpPlaceholderChanged;
}

export const GroupLayout = React.memo(function GroupLayout({
    group,
    renderItems,
    offset,
    properties,
    compactType,
    callbacks,
    layout,
    temporaryPlaceholder,
    dragStateRef,
    sharedDragPositionRef,
    isDragCaptured,
    isAnyDragging,
    currentDraggingItemId,
    isAnyDraggedOut,
    adjustWidgetLayout,
    getMemoForwardRefCallback,
}: GroupLayoutProps) {
    const {
        editMode,
        noOverlay,
        focusable,
        draggableHandleClassName,
        outerDnDEnable,
        onItemMountChange,
        onItemRender,
        onItemFocus,
        onItemBlur,
    } = React.useContext(DashKitContext);

    // Use group-specific noOverlay if it was explicitly set via groupGridProperties,
    // otherwise fallback to the dashboard-level noOverlay from context.
    const resolvedNoOverlay = 'noOverlay' in properties ? properties.noOverlay : noOverlay;

    // Memoize items array; non-source groups have stable false/null drag props so React skips their subtrees.
    const itemElements = React.useMemo(() => {
        return renderItems.map((item, i) => {
            const keyId = item.id;

            const isDragging = isAnyDragging && keyId === currentDraggingItemId;
            const isDraggedOut = isDragging && isAnyDraggedOut;

            return (
                <GridItem
                    key={keyId}
                    forwardedPluginRef={getMemoForwardRefCallback(offset + i)}
                    id={keyId}
                    item={item}
                    layout={layout}
                    adjustWidgetLayout={adjustWidgetLayout}
                    isDragging={isDragging}
                    isDraggedOut={isDraggedOut || undefined}
                    noOverlay={resolvedNoOverlay}
                    focusable={focusable}
                    withCustomHandle={Boolean(draggableHandleClassName)}
                    onItemMountChange={onItemMountChange}
                    onItemRender={onItemRender}
                    gridLayout={properties}
                    onItemFocus={onItemFocus}
                    onItemBlur={onItemBlur}
                />
            );
        });
    }, [
        renderItems,
        isAnyDragging,
        currentDraggingItemId,
        isAnyDraggedOut,
        offset,
        layout,
        adjustWidgetLayout,
        resolvedNoOverlay,
        focusable,
        draggableHandleClassName,
        onItemMountChange,
        onItemRender,
        properties,
        onItemFocus,
        onItemBlur,
        getMemoForwardRefCallback,
    ]);

    return (
        <Layout
            key={`group_${group}`}
            isDraggable={editMode}
            isResizable={editMode}
            {...properties}
            compactType={compactType}
            layout={layout}
            draggableCancel={`.${DRAGGABLE_CANCEL_CLASS_NAME}`}
            draggableHandle={draggableHandleClassName ? `.${draggableHandleClassName}` : undefined}
            onDragStart={callbacks.onDragStart}
            onDrag={callbacks.onDrag}
            onDragStop={callbacks.onDragStop}
            onResizeStart={callbacks.onResizeStart}
            onResize={callbacks.onResize}
            onResizeStop={callbacks.onResizeStop}
            onDragTargetRestore={callbacks.onDragTargetRestore}
            onDropDragOver={callbacks.onDropDragOver}
            onDrop={callbacks.onDrop}
            dragStateRef={dragStateRef}
            sharedDragPositionRef={sharedDragPositionRef}
            group={group}
            isDragCaptured={isDragCaptured}
            isDroppable={Boolean(outerDnDEnable) && editMode}
        >
            {itemElements}
            {temporaryPlaceholder}
        </Layout>
    );
}, groupLayoutPropsAreEqual);
