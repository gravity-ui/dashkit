import type {ReactGridLayoutProps} from 'src/typings';

import type {ConfigItem, ConfigLayout, ItemDragProps} from '../../shared';

export type GridLayoutProps = {
    ref?: React.ForwardedRef<unknown>;
};

export type GridLayoutState = {
    isDragging: boolean;
    isDraggedOut: boolean;
    isPageHidden: boolean;
    currentDraggingElement: CurrentDraggingElement | null;
    draggedOverGroup: string | null;
};

export type CurrentDraggingElement = {
    group: string;
    layoutItem: ConfigLayout;
    item: ConfigItem | ItemDragProps;
    cursorPosition: {
        offsetX: number;
        offsetY: number;
    };
};

export type ReloadItemsOptions = {
    targetIds?: string[];
    force?: boolean;
};

export type ManipulationCallbackArgs = {
    group: string;
    layout: ConfigLayout[];
    oldItem: ConfigLayout;
    newItem: ConfigLayout;
    placeholder: ConfigLayout;
    e: MouseEvent;
    element: HTMLElement;
};

export type MemoGroupLayout = {
    key: string;
    layout: ConfigLayout[];
};

export type GroupCallbacks = {
    onDragStart: (
        layout: ConfigLayout[],
        layoutItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) => void;
    onDrag: (
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) => void;
    onDragStop: (
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) => void;
    onResizeStart: (
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) => void;
    onResize: (
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) => void;
    onResizeStop: (
        layout: ConfigLayout[],
        oldItem: ConfigLayout,
        newItem: ConfigLayout,
        placeholder: ConfigLayout,
        e: MouseEvent,
        element: HTMLElement,
    ) => void;
    onDrop: (layout: ConfigLayout[], item: ConfigLayout | undefined, e: MouseEvent) => void | false;
    onDropDragOver: (e: DragEvent | MouseEvent) => void | boolean;
    onDragTargetRestore: (group?: string) => void;
};

export type AdjustWidgetLayoutParams = {
    widgetId: string;
    needSetDefault?: boolean;
    adjustedWidgetLayout?: ConfigLayout;
};

export type LayoutAndPropsByGroup = {
    properties: Partial<ReactGridLayoutProps>;
    layout: ConfigLayout[];
};
