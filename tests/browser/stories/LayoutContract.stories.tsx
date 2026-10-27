import React from 'react';

import type {Meta, StoryFn} from '@storybook/react';

import {DashKit} from '../../../src/components/DashKit/DashKit';
import {DashKitGridStack} from '../../../src/components/GridStack/DashKitGridStack';
import type {Config} from '../../../src/shared';
import type {DashKitGroup, PluginWidgetProps} from '../../../src/typings';

const type = 'layout-contract-widget';
const boundedType = 'layout-contract-bounded-widget';
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

DashKit.reloadPlugins({
    type: boundedType,
    defaultLayout: {w: 2, h: 2, minW: 1, minH: 1, maxW: 4, maxH: 4},
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
const boundedInitial: Config = {
    ...initial,
    items: [{...initial.items[0], type: boundedType}],
    layout: [{i: 'a', x: 0, y: 0, w: 2, h: 2}],
};
const boundedGroups: DashKitGroup[] = [
    {
        gridProperties: () => ({
            cols: 12,
            rowHeight: 20,
            margin: [0, 0],
            containerPadding: [0, 0],
            compactType: null,
            autoSize: false,
            style: {height: 400},
            isBounded: true,
            width: 600,
        }),
    },
];
const engines = {legacy: DashKit, gridstack: DashKitGridStack};
function Contract({
    engine = 'legacy',
    bounded = false,
    customResize = false,
    delayedAck = false,
}: {
    engine?: keyof typeof engines;
    bounded?: boolean;
    customResize?: boolean;
    delayedAck?: boolean;
}) {
    const Component = engines[engine];
    const [config, setConfig] = React.useState(bounded ? boundedInitial : initial);
    const [savedConfig, setSavedConfig] = React.useState(config);
    const [editing, setEditing] = React.useState(true);
    const [events, setEvents] = React.useState(0);
    const [northWest, setNorthWest] = React.useState(false);
    const [handleLabel, setHandleLabel] = React.useState('old');
    let activeGroups: DashKitGroup[] = bounded ? boundedGroups : groups;
    if (customResize) {
        activeGroups = [
            {
                gridProperties: () => ({
                    cols: 640,
                    rowHeight: 1,
                    width: 640,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                    autoSize: false,
                    allowOverlap: true,
                    noOverlay: handleLabel === 'old',
                    resizeHandles: northWest ? ['nw'] : ['se'],
                    resizeHandle: (direction, ref?: React.Ref<HTMLSpanElement>) => (
                        <span
                            ref={ref}
                            className={`react-resizable-handle react-resizable-handle-${direction}`}
                            data-qa="custom-resize"
                        >
                            {direction} {handleLabel}
                        </span>
                    ),
                }),
            },
        ];
    }
    return (
        <div>
            <button onClick={() => setEditing((value) => !value)}>Toggle edit</button>
            <button onClick={() => setConfig({...(bounded ? boundedInitial : initial)})}>
                Restore
            </button>
            <button onClick={() => setNorthWest(true)}>Use northwest handles</button>
            <button onClick={() => setHandleLabel('new')}>Update handle renderer</button>
            {delayedAck && (
                <>
                    <button onClick={() => setConfig(savedConfig)}>Acknowledge same</button>
                    <button onClick={() => setConfig(structuredClone(savedConfig))}>
                        Acknowledge clone
                    </button>
                    <button onClick={() => setConfig(structuredClone(boundedInitial))}>
                        External reset
                    </button>
                </>
            )}
            <span data-qa="event-count">Events: {events}</span>
            <div data-qa="canvas" style={{width: bounded ? 600 : 640, height: 400}}>
                <Component
                    config={config}
                    groups={activeGroups}
                    editMode={editing}
                    onChange={({config: next}) => {
                        setSavedConfig(next);
                        if (!delayedAck) {
                            setConfig(next);
                        }
                        setEvents((value) => value + 1);
                    }}
                />
            </div>
            <pre data-qa="saved-config">{JSON.stringify(delayedAck ? savedConfig : config)}</pre>
        </div>
    );
}
export default {title: 'Tests/Layout Contract', component: Contract} as Meta;
export const FlatContract: StoryFn<typeof Contract> = (args) => <Contract {...args} />;
FlatContract.args = {engine: 'legacy'};

export const BoundedContract: StoryFn<typeof Contract> = (args) => <Contract {...args} />;
BoundedContract.args = {engine: 'legacy', bounded: true};

export const ResizeControls: StoryFn<typeof Contract> = (args) => <Contract {...args} />;
ResizeControls.args = {engine: 'legacy', customResize: true};

export const DelayedAcknowledgment: StoryFn<typeof Contract> = (args) => <Contract {...args} />;
DelayedAcknowledgment.args = {engine: 'legacy', bounded: true, delayedAck: true};
