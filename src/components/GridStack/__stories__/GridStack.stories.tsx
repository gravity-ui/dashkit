import React from 'react';

import type {Meta, StoryFn} from '@storybook/react';

import type {Config} from '../../../shared';
import {DashKitGridStack} from '../DashKitGridStack';
DashKitGridStack.reloadPlugins({
    type: 'flat-gridstack-example',
    renderer: ({data}) => <div>{String(data.text)}</div>,
});
const initial: Config = {
    salt: 'flat-gridstack',
    counter: 1,
    aliases: {},
    connections: [],
    items: [
        {
            id: 'title',
            type: 'flat-gridstack-example',
            namespace: 'default',
            data: {text: 'Native flat layout'},
        },
    ],
    layout: [{i: 'title', x: 0, y: 0, w: 12, h: 2}],
};
function FlatExample({initialConfig = initial}: {initialConfig?: Config}) {
    const [config, setConfig] = React.useState(initialConfig);
    return (
        <DashKitGridStack config={config} editMode onChange={({config: next}) => setConfig(next)} />
    );
}
export default {title: 'GridStack', component: FlatExample} as Meta;
export const Flat: StoryFn = () => <FlatExample />;

export const NestedContainers: StoryFn = () => (
    <FlatExample
        initialConfig={{
            ...initial,
            layoutVersion: 2,
            containers: [
                {
                    id: 'panel',
                    x: 0,
                    y: 0,
                    w: 36,
                    h: 12,
                    padding: [12, 12, 12, 12],
                    gap: [8, 8],
                    grid: {cols: 12, rowHeight: 24, compactType: null},
                },
            ],
            items: [
                initial.items[0],
                {...initial.items[0], id: 'second', data: {text: 'Nested widget'}},
            ],
            layout: [
                {i: 'title', containerId: 'panel', x: 0, y: 0, w: 5, h: 2},
                {i: 'second', containerId: 'panel', x: 6, y: 2, w: 5, h: 2},
            ],
        }}
    />
);
