import React from 'react';

export type ActionPanelItem = {
    id: string;
    icon: React.ReactNode;
    title: string;
    onClick?: () => void;
    className?: string;
    qa?: string;
    pluginType?: string;
};

export type ActionPanelProps = {
    items: ActionPanelItem[];
    className?: string;
    disable?: boolean;
    toggleAnimation?: boolean;
};
