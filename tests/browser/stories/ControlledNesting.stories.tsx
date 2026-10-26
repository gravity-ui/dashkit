import React from 'react';

import type {Meta, StoryFn} from '@storybook/react';

import {DashKitGridStack} from '../../../src/gridstack';
import type {Config, LayoutContainer} from '../../../src/shared';
import type {DashKitGroup, PluginWidgetProps} from '../../../src/typings';

let identity = 0;
class Widget extends React.Component<PluginWidgetProps> {
    private identity = ++identity;
    render() {
        return (
            <div
                data-nested-widget={this.props.id}
                data-instance={this.identity}
                style={{width: '100%', height: '100%', background: '#dcecff'}}
            >
                {this.props.id}
            </div>
        );
    }
    getMeta = () => Promise.resolve({identity: this.identity});
}
const type = 'controlled-nesting-browser';
DashKitGridStack.reloadPlugins({
    type,
    defaultLayout: {w: 100, h: 70, minW: 1, minH: 1},
    renderer: (props, ref) => <Widget {...props} ref={ref} />,
});
const panel: LayoutContainer = {
    id: 'panel',
    x: 0,
    y: 0,
    w: 400,
    h: 280,
    padding: [10, 10, 10, 10],
    gap: [0, 0],
    grid: {cols: 380, rowHeight: 1, compactType: null},
};
const initial: Config = {
    salt: 'contained',
    counter: 1,
    aliases: {},
    connections: [],
    layoutVersion: 2,
    containers: [panel],
    items: ['a', 'b'].map((id) => ({id, type, namespace: 'default', data: {}})),
    layout: [
        {i: 'a', containerId: 'panel', x: 20, y: 20, w: 100, h: 70},
        {i: 'b', x: 450, y: 20, w: 100, h: 70},
    ],
};
const groups: DashKitGroup[] = [
    {
        gridProperties: () => ({
            cols: 640,
            width: 640,
            rowHeight: 1,
            margin: [0, 0],
            containerPadding: [0, 0],
            compactType: null,
            maxRows: 500,
            resizeHandles: ['se'],
        }),
    },
];
function ControlledNesting() {
    const [config, setConfig] = React.useState(initial);
    const [events, setEvents] = React.useState(0);
    return (
        <div>
            <button onClick={() => setConfig(initial)}>Restore nested</button>
            <button
                onClick={() =>
                    setConfig({
                        ...initial,
                        layout: [{i: 'a', x: 40, y: 320, w: 100, h: 70}, initial.layout[1]],
                    })
                }
            >
                Reparent to root
            </button>
            <span data-qa="nesting-events">{events}</span>
            <div style={{width: 640}}>
                <DashKitGridStack
                    config={config}
                    groups={groups}
                    editMode
                    onChange={({config: next}) => {
                        setConfig(next);
                        setEvents((count) => count + 1);
                    }}
                />
            </div>
            <pre data-qa="nested-config">{JSON.stringify(config)}</pre>
        </div>
    );
}
export default {title: 'Tests/Controlled Nesting', component: ControlledNesting} as Meta;
export const Contained: StoryFn = () => <ControlledNesting />;
