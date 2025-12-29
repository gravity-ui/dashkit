import type {DragOverEvent} from 'react-grid-layout';

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

type GroupCallback = (
    layout: ConfigLayout[],
    layoutItem: ConfigLayout,
    newItem: ConfigLayout,
    placeholder: ConfigLayout,
    event: MouseEvent,
    element: HTMLElement,
) => void;

export type GroupCallbacks = {
    onDragStart: GroupCallback;
    onDrag: GroupCallback;
    onDragStop: GroupCallback;
    onResizeStart: GroupCallback;
    onResize: GroupCallback;
    onResizeStop: GroupCallback;
    onDrop: (layout: ConfigLayout[], item: ConfigLayout | undefined, e: MouseEvent) => void | false;
    onDropDragOver: (event: DragOverEvent) => {w?: number; h?: number} | false | undefined;
    onDragTargetRestore: (group?: string) => void;
};

export type LayoutAndPropsByGroup = {
    properties: Partial<ReactGridLayoutProps>;
    layout: ConfigLayout[];
};
