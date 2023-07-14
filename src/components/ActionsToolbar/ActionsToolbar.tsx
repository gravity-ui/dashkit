import React from 'react';
import block from 'bem-cn-lite';

import {Icon, Text, IconProps} from '@gravity-ui/uikit';

import './ActionsToolbar.scss';

const b = block('actions-toolbar');

export interface ActionsToolbarProps {
    controls: ActionsToolbarButton[];
    className?: string;
}

export interface ActionsToolbarButton {
    icon: IconProps['data'];
    text: React.ReactNode;
    handler: () => void;
    iconSize?: number;
}

const WidgetButton = ({icon, text, handler}: ActionsToolbarButton) => (
    <div className={b('button')} onClick={handler}>
        <Icon size={'18'} className={b('icon')} data={icon} />
        <Text variant={'body-1'}>{text}</Text>
    </div>
);

export const ActionsToolbar: React.FC<ActionsToolbarProps> = (props) => {
    return (
        <div className={`${b()} ${props.className}`}>
            {props.controls.map((button, index) => {
                return (
                    <WidgetButton
                        key={index}
                        icon={button.icon}
                        text={button.text}
                        handler={button.handler}
                    />
                );
            })}
        </div>
    );
};
