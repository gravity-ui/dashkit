import React from 'react';

import type {ItemDragProps} from '../../shared';

export type ActionPanelItem = {
    id: string;
    icon: React.ReactNode;
    title: string;
    className?: string;
    qa?: string;
    onClick?: () => void;
    dragProps?: ItemDragProps;
    renderItem?: (
        props: Omit<ActionPanelItem, 'renderItem'> & {key: React.Key; children: React.ReactNode},
    ) => JSX.Element;
};

export type ActionPanelProps = {
    items: ActionPanelItem[];
    className?: string;
    disable?: boolean;
    toggleAnimation?: boolean;
};
