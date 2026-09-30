import React from 'react';

import {ThemeContext} from '@gravity-ui/uikit';
import {CSSTransition} from 'react-transition-group';

import {useDnDItemProps} from '../../hooks/useDnDItemProps';
import {cn} from '../../utils/cn';

import {ActionPanelItem, ActionPanelProps} from './types';

import './ActionPanel.scss';

const b = cn('dashkit-action-panel');

export const ActionPanelItemContainer = ({item}: {item: ActionPanelItem}) => {
    const dndProps = useDnDItemProps(item);
    const draggingClassName = `${b('item')}_dragging`;
    const disabledSourceClassName = `${b('item')}_dragging-source-disabled`;
    const disableSourceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(
        () => () => {
            if (disableSourceTimer.current !== null) {
                clearTimeout(disableSourceTimer.current);
            }
        },
        [],
    );

    const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
        const source = event.currentTarget;
        source.classList.add(draggingClassName);
        dndProps?.onDragStart(event);
        // The native drag image captures the solid item before the panel source is disabled.
        disableSourceTimer.current = setTimeout(() => {
            source.classList.add(disabledSourceClassName);
            disableSourceTimer.current = null;
        }, 0);
    };

    const onDragEnd = (event: React.DragEvent<HTMLDivElement>) => {
        if (disableSourceTimer.current !== null) {
            clearTimeout(disableSourceTimer.current);
            disableSourceTimer.current = null;
        }
        event.currentTarget.classList.remove(draggingClassName, disabledSourceClassName);
        dndProps?.onDragEnd(event);
    };

    return (
        <div
            role="button"
            className={b('item', {draggable: Boolean(dndProps)}, item.className)}
            onClick={item.onClick}
            data-qa={item.qa}
            {...dndProps}
            onDragStart={dndProps ? onDragStart : undefined}
            onDragEnd={dndProps ? onDragEnd : undefined}
        >
            <div className={b('icon')}>{item.icon}</div>
            <div className={b('title')} title={item.title}>
                {item.title}
            </div>
        </div>
    );
};

export const ActionPanel = (props: ActionPanelProps) => {
    const theme = React.useContext(ThemeContext)?.themeValue ?? 'unset';
    const isDisabled = props.disable ?? false;
    const isAnimated = props.toggleAnimation ?? false;
    const nodeRef = React.useRef<HTMLDivElement | null>(null);

    const content = (
        <div ref={nodeRef} className={b({theme}, props.className)}>
            {props.items.map(({wrapTo, ...item}) => {
                const key = `dk-action-panel-${item.id}`;
                const children = <ActionPanelItemContainer key={key} item={item} />;

                return wrapTo ? wrapTo({...item, key, children}) : children;
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
