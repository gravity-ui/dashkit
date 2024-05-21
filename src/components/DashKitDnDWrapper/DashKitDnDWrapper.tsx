import React from 'react';

import {DashKitDnDContext} from '../../context/DashKitContext';
import type {ItemDragProps} from '../../shared';

type DashKitDnDWrapperProps = {
    dragImageSrc?: string;
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

    const onDragStart = React.useCallback(
        (_: React.DragEvent<Element>, itemDragProps: ItemDragProps) => {
            setDragProps(itemDragProps);
            props.onDragStart?.(itemDragProps);
        },
        [setDragProps, props.onDragStart],
    );

    const onDragEnd = React.useCallback(
        (_: React.DragEvent<Element>) => {
            setDragProps(null);
            props.onDragEnd?.();
        },
        [setDragProps, props.onDragEnd],
    );

    const contextValue = React.useMemo(() => {
        return {
            dragProps,
            dragImagePreview,
            onDragStart,
            onDragEnd,
        };
    }, [dragProps, dragImagePreview, onDragStart, onDragEnd]);

    return (
        <DashKitDnDContext.Provider value={contextValue}>
            {props.children}
        </DashKitDnDContext.Provider>
    );
};
