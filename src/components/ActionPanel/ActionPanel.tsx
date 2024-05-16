import React from 'react';

import {CSSTransition} from 'react-transition-group';

import {DashKitDnDContext} from '../../context/DashKitContext';
import {cn} from '../../utils/cn';

import {ActionPanelItem, ActionPanelProps} from './types';

import './ActionPanel.scss';

type DndProps =
    | {}
    | {
          draggable: true;
          unselectable: 'on';
          onDragStart: React.DragEventHandler<HTMLDivElement>;
          onDragEnd: React.DragEventHandler<HTMLDivElement>;
      };

const b = cn('dashkit-action-panel');

export const ActionPanelItemContainer = ({item}: {item: ActionPanelItem}) => {
    const dragContext = React.useContext(DashKitDnDContext);

    const onDragStart = React.useCallback(
        (e: React.DragEvent) => {
            dragContext?.onDragStart(e, item.dragProps);
        },
        [dragContext?.onDragStart, item.dragProps],
    );

    const onDragEnd = React.useCallback<React.DragEventHandler<HTMLDivElement>>(
        (e) => {
            dragContext?.onDragEnd(e);
        },
        [dragContext?.onDragEnd],
    );

    let dndProps: DndProps = {};

    if (item.dragProps) {
        dndProps = {
            draggable: true,
            unselectable: 'on',
            onDragStart,
            onDragEnd,
        };
    }

    return (
        <div
            role="button"
            className={b('item', item.className)}
            key={`dk-action-panel-${item.id}`}
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
            {props.items.map((item, i) => (
                <ActionPanelItemContainer key={`item_${i}`} item={item} />
            ))}
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
