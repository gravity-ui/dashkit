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

import {ActionPanel, DashKit} from '../../..';

import {Demo, DemoRow} from './Demo';
import {getConfig} from './utils';

export const CssApiShowcase: React.FC = () => {
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
