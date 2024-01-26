import React from 'react';

import {cn} from '../../utils/cn';

import {useCssTransitionWatcher, useMount} from './hooks';
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
    slideAnimation?: boolean;
    hide?: boolean;
};

const b = cn('dashkit-action-panel');

export const ActionPanel = (props: ActionPanelProps) => {
    const isMounted = useMount();
    const isAnimationEnabled = (props.slideAnimation ?? true) && isMounted;
    const isHidden = props.hide ?? !isMounted;

    const ref = React.useRef<HTMLDivElement | null>(null);
    const {isReadyToBeRemoved, hiddenState, isPending} = useCssTransitionWatcher({
        isEnabled: isAnimationEnabled,
        isHidden,
        ref,
    });

    if (isReadyToBeRemoved && isMounted) {
        return null;
    }

    return (
        <div
            ref={ref}
            className={b(
                {
                    hidden: hiddenState,
                    'slide-animation': isAnimationEnabled && isPending,
                },
                props.className,
            )}
        >
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
};
