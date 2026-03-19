import React from 'react';

import {DRAGGABLE_CANCEL_CLASS_NAME} from '../../constants';
import {DashKitContext} from '../../context';
import type {ConfigItem, ConfigLayout} from '../../shared';
import type {PluginRef, PluginWidgetProps, ReactGridLayoutProps} from '../../typings';
import GridItem from '../GridItem/GridItem';

import {Layout} from './ReactGridLayout';
import type {GroupCallbacks} from './types';

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

    // Drag state specific to this group (computed in GridLayout.renderGroup)
    // hasSharedDragItem and sharedDragPosition replaced by stable refs read
    // imperatively by DragOverLayout — no React prop change on drag start.
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

function renderItemsAreEqual(a: ConfigItem[], b: ConfigItem[]): boolean {
    if (a === b) {
        return true;
    }
    if (a.length !== b.length) {
        return false;
    }
    return a.every((item, i) => item === b[i]);
}

function propertiesAreEqual(
    a: Partial<ReactGridLayoutProps>,
    b: Partial<ReactGridLayoutProps>,
): boolean {
    if (a === b) {
        return true;
    }
    const keysA = Object.keys(a) as Array<keyof ReactGridLayoutProps>;
    const keysB = Object.keys(b) as Array<keyof ReactGridLayoutProps>;
    if (keysA.length !== keysB.length) {
        return false;
    }
    return keysA.every((key) => a[key] === b[key]);
}

function groupLayoutPropsAreEqual(prev: GroupLayoutProps, next: GroupLayoutProps): boolean {
    // Re-render if group identity, items, or computed layout/properties changed
    if (
        prev.group !== next.group ||
        prev.layout !== next.layout ||
        prev.offset !== next.offset ||
        !renderItemsAreEqual(prev.renderItems, next.renderItems) ||
        !propertiesAreEqual(prev.properties, next.properties)
    ) {
        return false;
    }

    // Re-render if drag state scoped to this group changed.
    // hasSharedDragItem and sharedDragPosition are now refs — same object reference
    // forever — so they never trigger a re-render here.
    if (
        prev.isDragCaptured !== next.isDragCaptured ||
        prev.isAnyDragging !== next.isAnyDragging ||
        prev.currentDraggingItemId !== next.currentDraggingItemId ||
        prev.isAnyDraggedOut !== next.isAnyDraggedOut
    ) {
        return false;
    }

    if (prev.temporaryPlaceholder !== next.temporaryPlaceholder) {
        return false;
    }

    return true;
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
    // otherwise fall back to the dashboard-level noOverlay from context.
    const resolvedNoOverlay = 'noOverlay' in properties ? properties.noOverlay : noOverlay;

    // Memoize the items element array so that when GroupLayout re-renders due to
    // hasSharedDragItem changing (all non-source groups become drop-ready on drag start),
    // the items subtree is not recreated if the drag-relevant props are unchanged.
    // For non-source groups isAnyDragging/currentDraggingItemId/isAnyDraggedOut are
    // scoped to stable false/null by GridLayout.renderGroup, so the cached array is
    // returned and React skips all GridItem subtrees entirely.
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
