import React from 'react';

import type {Meta, StoryFn} from '@storybook/react';

import {DashKitGridStack} from '../../../gridstack';
import type {DashKitGridStackProps, GridStackConfig} from '../../../gridstack';
import type {DashKitGroup} from '../../../typings';

const TYPE = 'gridstack-example';
DashKitGridStack.reloadPlugins({
    type: TYPE,
    defaultLayout: {w: 3, h: 2, minW: 1, minH: 1},
    renderer: ({id}) => (
        <div
            style={{
                width: '100%',
                height: '100%',
                padding: 8,
                boxSizing: 'border-box',
                background: 'var(--g-color-base-generic)',
                border: '1px solid var(--g-color-line-generic)',
            }}
        >
            {id}
        </div>
    ),
});

const CONFIG: GridStackConfig = {
    salt: 'gridstack-example',
    counter: 1,
    aliases: {},
    connections: [],
    items: ['a', 'b'].map((id) => ({id, type: TYPE, namespace: 'default', data: {}})),
    layout: [
        {i: 'a', x: 0, y: 0, w: 4, h: 2},
        {i: 'b', x: 6, y: 2, w: 4, h: 2},
    ],
};
const GROUPS: DashKitGroup[] = [
    {gridProperties: () => ({cols: 12, rowHeight: 36, compactType: null})},
];

const Template: StoryFn<DashKitGridStackProps> = ({config: initialConfig, ...props}) => {
    const [config, setConfig] = React.useState(initialConfig);
    return (
        <div style={{width: 640, maxWidth: '100%'}}>
            <DashKitGridStack
                {...props}
                config={config}
                onChange={({config: next}) => setConfig(next)}
            />
        </div>
    );
};

export default {
    title: 'Components/GridStack',
    component: DashKitGridStack,
    args: {config: CONFIG, groups: GROUPS, editMode: true},
    argTypes: {config: {control: false}, groups: {control: false}},
} as Meta<typeof DashKitGridStack>;

export const FluidLayout = Template.bind({});

export const FixedPixelCanvas = Template.bind({});
FixedPixelCanvas.args = {
    config: {
        ...CONFIG,
        layout: [
            {i: 'a', x: 40, y: 40, w: 160, h: 100},
            {i: 'b', x: 260, y: 180, w: 180, h: 120},
        ],
    },
    groups: [
        {
            gridProperties: () => ({
                cols: 640,
                rowHeight: 1,
                margin: [0, 0],
                containerPadding: [0, 0],
                compactType: null,
                maxRows: 400,
                autoSize: false,
                style: {height: 400},
            }),
        },
    ],
};

export const NestedContainers = Template.bind({});
NestedContainers.args = {
    config: {
        ...CONFIG,
        layoutVersion: 2,
        containers: [
            {
                id: 'panel',
                x: 0,
                y: 0,
                w: 12,
                h: 8,
                padding: [12, 12, 12, 12],
                gap: [8, 8],
                grid: {cols: 12, rowHeight: 24, compactType: null},
            },
        ],
        layout: CONFIG.layout.map((item) => ({...item, containerId: 'panel'})),
    },
};

export const CrossZones = Template.bind({});
CrossZones.args = {
    config: {
        ...CONFIG,
        layout: CONFIG.layout.map((item, index) => ({
            ...item,
            parent: index ? 'right' : 'left',
            x: 0,
            y: 0,
        })),
    },
    groups: ['left', 'right'].map((id) => ({
        id,
        gridProperties: () => ({cols: 12, rowHeight: 36, compactType: null, width: 300}),
        render: (key, children) => (
            <section key={key} style={{display: 'inline-block', width: 300, verticalAlign: 'top'}}>
                {children}
            </section>
        ),
    })),
};
