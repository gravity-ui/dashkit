import React from 'react';

import {DashKitDnDContext} from '../../context/DashKitContext';

type DashKitDnDWrapperProps = {
    children: React.ReactElement;
};

export const DashKitDnDWrapper: React.FC<DashKitDnDWrapperProps> = (props) => {
    const [dragPluginType, setDragPluginType] = React.useState<string | null>(null);

    const onDragStart = React.useCallback(
        (_: React.DragEvent<Element>, type: string) => {
            setDragPluginType(type);
        },
        [setDragPluginType],
    );

    const onDragEnd = React.useCallback(
        (_: React.DragEvent<Element>) => {
            setDragPluginType(null);
        },
        [setDragPluginType],
    );

    const contextValue = React.useMemo(() => {
        return {
            dragPluginType,
            onDragStart,
            onDragEnd,
        };
    }, [dragPluginType, onDragStart, onDragEnd]);

    return (
        <DashKitDnDContext.Provider value={contextValue}>
            {props.children}
        </DashKitDnDContext.Provider>
    );
};
