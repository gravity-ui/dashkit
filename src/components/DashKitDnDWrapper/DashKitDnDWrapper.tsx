import React from 'react';

import {DashKitDnDContext} from '../../context/DashKitContext';
import type {DragProps} from '../../shared';

type DashKitDnDWrapperProps = {
    children: React.ReactElement;
};

export const DashKitDnDWrapper: React.FC<DashKitDnDWrapperProps> = (props) => {
    const [dragProps, setDragProps] = React.useState<DragProps | null>(null);

    const onDragStart = React.useCallback(
        (_: React.DragEvent<Element>, currentProps: DragProps) => {
            setDragProps(currentProps);
        },
        [setDragProps],
    );

    const onDragEnd = React.useCallback(
        (_: React.DragEvent<Element>) => {
            setDragProps(null);
        },
        [setDragProps],
    );

    const contextValue = React.useMemo(() => {
        return {
            dragProps,
            onDragStart,
            onDragEnd,
        };
    }, [dragProps, onDragStart, onDragEnd]);

    return (
        <DashKitDnDContext.Provider value={contextValue}>
            {props.children}
        </DashKitDnDContext.Provider>
    );
};
