import React from 'react';

import {cn} from '../../utils/cn';

import './ActionPanel.scss';

export type ActionPanelItem = {
    id: string;
    icon: React.ReactNode;
    title: string | React.ReactNode;
    onClick?: () => void;
};

type ActionPanelProps = {
    items: ActionPanelItem[];
};

const b = cn('dashkit-action-panel');

export const ActionPanel = (props: ActionPanelProps) => {
    return (
        <div className={b()}>
            {props.items.map((item) => {
                return (
                    <div
                        className={b('item')}
                        key={`dk-action-panel-${item.id}`}
                        onClick={item.onClick}
                    >
                        <div className={b('icon')}>{item.icon}</div>
                        <div className={b('title')}>{item.title}</div>
                    </div>
                );
            })}
        </div>
    );
};
