import React from 'react';

import {DashKitDnDContext} from '../../context';
import type {DraggedOverItem, ItemDragProps} from '../../shared';

type DashKitDnDWrapperProps = {
    dragImageSrc?: string;
    onDropDragOver?: (
        draggedItem: DraggedOverItem,
        sharedItem: DraggedOverItem | null,
    ) => void | boolean;
    onDragStart?: (dragProps: ItemDragProps) => void;
    onDragEnd?: () => void;
    children: React.ReactElement;
};

export const DashKitDnDWrapper: React.FC<DashKitDnDWrapperProps> = (props) => {
    const [dragProps, setDragProps] = React.useState<ItemDragProps | null>(null);

    const dragImagePreview = React.useMemo(() => {
        if (!props.dragImageSrc) {
            return null;
        }

        const img = new Image();
        img.src = props.dragImageSrc;
        return img;
    }, [props.dragImageSrc]);

    const onDragStartProp = props.onDragStart;
    const onDragStart = React.useCallback(
        (_: React.DragEvent<Element>, itemDragProps: ItemDragProps) => {
            setDragProps(itemDragProps);
            onDragStartProp?.(itemDragProps);
        },
        [setDragProps, onDragStartProp],
    );

    const onDragEndProp = props.onDragEnd;
    const onDragEnd = React.useCallback(
        (_: React.DragEvent<Element>) => {
            setDragProps(null);
            onDragEndProp?.();
        },
        [setDragProps, onDragEndProp],
    );

    const contextValue = React.useMemo(() => {
        return {
            dragProps,
            dragImagePreview,
            onDragStart,
            onDragEnd,
            onDropDragOver: props.onDropDragOver,
        };
    }, [dragProps, dragImagePreview, onDragStart, onDragEnd, props.onDropDragOver]);

    return (
        <DashKitDnDContext.Provider value={contextValue}>
            {props.children}
        </DashKitDnDContext.Provider>
    );
};
