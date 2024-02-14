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
    disable?: boolean;
    toggleAnimation?: boolean;
};

const b = cn('dashkit-action-panel');

export const ActionPanel = (props: ActionPanelProps) => {
    const isDisabled = props.disable ?? false;
    const isAnimated = props.toggleAnimation ?? false;
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

    if (isAnimated) {
        return (
            <CSSTransition
                in={!isDisabled}
                nodeRef={nodeRef}
                classNames={b(null)}
                timeout={300}
                unmountOnExit
            >
                {content}
            </CSSTransition>
        );
    } else {
        return isDisabled ? null : content;
    }
};
