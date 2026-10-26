import React from 'react';

import type {Meta, StoryFn} from '@storybook/react';

import {DashKit} from '../../../src/components/DashKit/DashKit';
import {DashKitGridStack} from '../../../src/components/GridStack/DashKitGridStack';
import type {Config} from '../../../src/shared';
import type {DashKitGroup, PluginWidgetProps} from '../../../src/typings';

const type = 'layout-contract-widget';
let identity = 0;
class Widget extends React.Component<PluginWidgetProps> {
    private identity = ++identity;
    render() {
        return (
            <div
                data-widget-id={this.props.id}
                data-widget-instance={this.identity}
                style={{
                    width: '100%',
                    height: '100%',
                    background: '#dcecff',
                    border: '1px solid #628ab3',
                    boxSizing: 'border-box',
                }}
            >
                {this.props.id}
                <button
                    data-qa={`grow-${this.props.id}`}
                    onClick={() => {
                        const layout = this.props.layout.find(({i}) => i === this.props.id);
                        if (!layout) {
                            throw new Error('Missing widget layout');
                        }
                        this.props.adjustWidgetLayout({
                            widgetId: this.props.id,
                            adjustedWidgetLayout: {...layout, h: layout.h + 40},
                        });
                    }}
                >
                    Grow
                </button>
                <button
                    data-qa={`reset-${this.props.id}`}
                    onClick={() =>
                        this.props.adjustWidgetLayout({
                            widgetId: this.props.id,
                            needSetDefault: true,
                        })
                    }
                >
                    Reset height
                </button>
            </div>
        );
    }
}
DashKit.reloadPlugins({
    type,
    defaultLayout: {w: 100, h: 80, minW: 20, minH: 20},
    renderer: (props, ref) => <Widget {...props} ref={ref} />,
});

const initial: Config = {
    salt: 'layout-contract',
    counter: 1,
    aliases: {},
    connections: [],
    items: ['a', 'b'].map((id) => ({id, type, namespace: 'default', data: {}})),
    layout: [
        {i: 'a', x: 40, y: 40, w: 160, h: 100},
        {i: 'b', x: 120, y: 80, w: 180, h: 120},
    ],
};
const groups: DashKitGroup[] = [
    {
        gridProperties: () => ({
            cols: 640,
            rowHeight: 1,
            margin: [0, 0],
            containerPadding: [0, 0],
            compactType: null,
            autoSize: false,
            allowOverlap: true,
            maxRows: 400,
            width: 640,
            resizeHandles: ['se'],
        }),
    },
];
const engines = {legacy: DashKit, gridstack: DashKitGridStack};
function Contract({engine = 'legacy'}: {engine?: keyof typeof engines}) {
    const Component = engines[engine];
    const [config, setConfig] = React.useState(initial);
    const [editing, setEditing] = React.useState(true);
    const [events, setEvents] = React.useState(0);
    return (
        <div>
            <button onClick={() => setEditing((value) => !value)}>Toggle edit</button>
            <button onClick={() => setConfig(initial)}>Restore</button>
            <span data-qa="event-count">Events: {events}</span>
            <div style={{width: 640, height: 400}}>
                <Component
                    config={config}
                    groups={groups}
                    editMode={editing}
                    onChange={({config: next}) => {
                        setConfig(next);
                        setEvents((value) => value + 1);
                    }}
                />
            </div>
            <pre data-qa="saved-config">{JSON.stringify(config)}</pre>
        </div>
    );
}
export default {title: 'Tests/Layout Contract', component: Contract} as Meta;
export const FlatContract: StoryFn<typeof Contract> = (args) => <Contract {...args} />;
FlatContract.args = {engine: 'legacy'};
