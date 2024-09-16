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
    wrapTo?: (
        props: Omit<ActionPanelItem, 'wrapTo'> & {key: React.Key; children: React.ReactNode},
    ) => React.ReactNode;
};

export type ActionPanelProps = {
    items: ActionPanelItem[];
    className?: string;
    disable?: boolean;
    toggleAnimation?: boolean;
};
