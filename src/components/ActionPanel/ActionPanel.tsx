import React from 'react';

import {CSSTransition} from 'react-transition-group';

import {useDnDItemProps} from '../../hooks/useDnDItemProps';
import {cn} from '../../utils/cn';

import {ActionPanelItem, ActionPanelProps} from './types';

import './ActionPanel.scss';

const b = cn('dashkit-action-panel');

export const ActionPanelItemContainer = ({item}: {item: ActionPanelItem}) => {
    const dndProps = useDnDItemProps(item);

    return (
        <div
            role="button"
            className={b('item', {draggable: Boolean(dndProps)}, item.className)}
            onClick={item.onClick}
            data-qa={item.qa}
            {...dndProps}
        >
            <div className={b('icon')}>{item.icon}</div>
            <div className={b('title')} title={item.title}>
                {item.title}
            </div>
        </div>
    );
};

export const ActionPanel = (props: ActionPanelProps) => {
    const isDisabled = props.disable ?? false;
    const isAnimated = props.toggleAnimation ?? false;
    const nodeRef = React.useRef<HTMLDivElement | null>(null);

    const content = (
        <div ref={nodeRef} className={b(null, props.className)}>
            {props.items.map(({renderItem, ...item}) => {
                const key = `dk-action-panel-${item.id}`;
                const children = <ActionPanelItemContainer key={key} item={item} />;

                return renderItem ? renderItem({...item, key, children}) : children;
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
