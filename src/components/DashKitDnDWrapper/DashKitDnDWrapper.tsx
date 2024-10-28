import React from 'react';

import {DashKitDnDContext} from '../../context/DashKitContext';
import type {ItemDragProps, ItemDropDragOver} from '../../shared';

type DashKitDnDWrapperProps = {
    dragImageSrc?: string;
    onDropDragOver?: (
        draggedItem: ItemDropDragOver,
        sharedItem: ItemDropDragOver | null,
    ) => void | boolean;
    onDragStart?: (dragProps: ItemDragProps) => void;
    onDragEnd?: () => void;
    children: React.ReactElement;
};

const defaultImageSrc =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const DashKitDnDWrapper: React.FC<DashKitDnDWrapperProps> = (props) => {
    const [dragProps, setDragProps] = React.useState<ItemDragProps | null>(null);

    const dragImagePreview = React.useMemo(() => {
        const img = new Image();
        img.src = props.dragImageSrc || defaultImageSrc;
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
