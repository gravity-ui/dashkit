import React from 'react';
import {CSSTransition} from 'react-transition-group';

import {cn} from '../../utils/cn';

import './ActionPanel.scss';

export type ActionPanelItem = {
    id: string;
    icon: React.ReactNode;
    title: string;
    onClick?: () => void;
    className?: string;
    qa?: string;
};

export type ActionPanelProps = {
    items: ActionPanelItem[];
    className?: string;
    enable?: boolean;
};

const b = cn('dashkit-action-panel');

export const ActionPanel = (props: ActionPanelProps) => {
    const isHidden = !props.enable;
    const nodeRef = React.useRef<HTMLDivElement | null>(null);

    const content = (
        <div ref={nodeRef} className={b(null, props.className)}>
            {props.items.map((item) => {
                return (
                    <div
                        role="button"
                        className={b('item', item.className)}
                        key={`dk-action-panel-${item.id}`}
                        onClick={item.onClick}
                        data-qa={item.qa}
                    >
                        <div className={b('icon')}>{item.icon}</div>
                        <div className={b('title')} title={item.title}>
                            {item.title}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <CSSTransition
            in={!isHidden}
            nodeRef={nodeRef}
            classNames={b(null)}
            timeout={600}
            unmountOnExit
        >
            {content}
        </CSSTransition>
    );
};
