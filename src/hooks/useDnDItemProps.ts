import React from 'react';

import {ActionPanelItem} from '../components';
import {DashKitDnDContext} from '../context/DashKitContext';

type DndProps = null | {
    draggable: true;
    unselectable: 'on';
    onDragStart: React.DragEventHandler<HTMLDivElement>;
    onDragEnd: React.DragEventHandler<HTMLDivElement>;
};

export const useDnDItemProps = (item: ActionPanelItem): DndProps => {
    const dragContext = React.useContext(DashKitDnDContext);

    const onDragStart = React.useCallback(
        (e: React.DragEvent) => {
            if (dragContext && item.dragProps) {
                dragContext.onDragStart(e, item.dragProps);
                e.dataTransfer.setDragImage(dragContext.dragImagePreview, 0, 0);
            }
        },
        [dragContext, item.dragProps],
    );

    const onDragEnd = React.useCallback<React.DragEventHandler<HTMLDivElement>>(
        (e) => {
            if (dragContext) {
                dragContext.onDragEnd(e);
            }
        },
        [dragContext],
    );

    if (dragContext && item.dragProps) {
        return {
            draggable: true,
            unselectable: 'on',
            onDragStart,
            onDragEnd,
        };
    }

    return null;
};
