import React from 'react';

import {
    ChartColumn,
    Heading,
    Layers3Diagonal,
    PlugConnection,
    Sliders,
    TextAlignLeft,
} from '@gravity-ui/icons';
import {Icon} from '@gravity-ui/uikit';

import {ActionPanel, DashKit, MenuItems} from '../../..';
import i18n from '../../../i18n';
import {CogIcon} from '../../../icons/CogIcon';
import {CopyIcon} from '../../../icons/CopyIcon';
import {DeleteIcon} from '../../../icons/DeleteIcon';

import {Demo, DemoRow} from './Demo';
import {getConfig} from './utils';

export const CssApiShowcase: React.FC = () => {
    React.useEffect(() => {
        DashKit.setSettings({
            menu: [
                {
                    id: 'settings',
                    title: 'Menu setting text',
                    icon: <Icon data={CogIcon} size={16} />,
                },
                {
                    id: MenuItems.Copy,
                    title: 'Menu setting copy',
                    icon: <Icon data={CopyIcon} size={16} />,
                },
                {
                    id: MenuItems.Delete,
                    title: i18n('label_delete'), // for language change check
                    icon: <Icon data={DeleteIcon} size={16} />,
                    className: 'dashkit-overlay-controls__item_danger',
                },
            ],
        });
    }, []);

    const items = React.useMemo(
        () => [
            {
                id: 'chart',
                icon: <Icon data={ChartColumn} />,
                title: 'Chart',
                className: 'test',
                qa: 'chart',
            },
            {
                id: 'selector',
                icon: <Icon data={Sliders} />,
                title: 'Selector',
                qa: 'selector',
            },
            {
                id: 'text',
                icon: <Icon data={TextAlignLeft} />,
                title: 'Text',
            },
            {
                id: 'header',
                icon: <Icon data={Heading} />,
                title: 'Header',
            },
            {
                id: 'links',
                icon: <Icon data={PlugConnection} />,
                title: 'Links',
            },
            {
                id: 'tabs',
                icon: <Icon data={Layers3Diagonal} />,
                title: 'Tabs',
            },
        ],
        [],
    );

    return (
        <>
            <style>
                {`.g-root {
                    --dashkit-action-panel-border-color: var(--g-color-line-info);
                    --dashkit-action-panel-color: var(--g-color-base-float-accent);
                    --dashkit-action-panel-border-radius: var(--g-border-radius-xxl);

                    --dashkit-action-panel-item-color: transparent;
                    --dashkit-action-panel-item-text-color: var(--g-color-text-primary);
                    
                    --dashkit-action-panel-item-color-hover: var(--g-color-line-info);
                    --dashkit-action-panel-item-text-color-hover: white;

                    --dashkit-overlay-color: var(--g-color-line-info);
                    --dashkit-overlay-border-color: var(--g-color-line-info);
                    --dashkit-overlay-opacity: 0.5;

                    --dashkit-placeholder-color: var(--g-color-line-positive);
                    --dashkit-placeholder-opacity: 1;
                }`}
            </style>
            <Demo title="CSS API">
                <DemoRow title="Component view">
                    <ActionPanel items={items} />
                    <DashKit editMode={true} config={getConfig()} />
                </DemoRow>
            </Demo>
        </>
    );
};
