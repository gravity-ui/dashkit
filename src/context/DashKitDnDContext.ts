import React from 'react';

import type {DraggedOverItem, ItemDragProps} from '../shared/types';

export type DashKitDnDCtxShape = {
    dragProps: ItemDragProps | null;
    dragImagePreview: HTMLImageElement;
    onDragStart: (e: React.DragEvent<Element>, itemDragProps: ItemDragProps) => void;
    onDragEnd: (e: React.DragEvent<Element>) => void;
    onDropDragOver?: (
        draggedItem: DraggedOverItem,
        sharedItem: DraggedOverItem | null,
    ) => void | boolean;
};

export const DashKitDnDContext = React.createContext<DashKitDnDCtxShape | void>(undefined);
