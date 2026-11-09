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
function FlatExample() {
    const [config, setConfig] = React.useState(initial);
    return (
        <DashKitGridStack config={config} editMode onChange={({config: next}) => setConfig(next)} />
    );
}
export default {title: 'GridStack', component: FlatExample} as Meta;
export const Flat: StoryFn = () => <FlatExample />;
