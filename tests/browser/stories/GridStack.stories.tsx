import React from 'react';

import type {Meta, StoryFn} from '@storybook/react';
import {createPortal} from 'react-dom';

import {ActionPanel} from '../../../src/components/ActionPanel/ActionPanel';
import {DashKit} from '../../../src/components/DashKit/DashKit';
import type {DashKitLayoutRef} from '../../../src/components/DashKit/DashKitBase';
import {DashKitDnDWrapper} from '../../../src/components/DashKitDnDWrapper/DashKitDnDWrapper';
import {requireValue} from '../../../src/components/GridStack/invariants';
import type {GridStackConfig} from '../../../src/gridstack';
import {DashKitGridStack} from '../../../src/gridstack';
import type {DashKitGroup, PluginWidgetProps} from '../../../src/typings';

import {PaletteDocument} from './PaletteDocument';
import {PreviewOverlap as PreviewOverlapFixture} from './PreviewOverlap';

const type = 'gridstack-contract-widget';
class Widget extends React.Component<PluginWidgetProps> {
    private identity = Math.random().toString(36).slice(2);
    private renders = 0;
    render() {
        return (
            <div
                data-widget-id={this.props.id}
                data-widget-instance={this.identity}
                data-widget-renders={++this.renders}
                style={{
                    width: '100%',
                    height: '100%',
                    background: '#dcecff',
                    border: '1px solid #628ab3',
                    boxSizing: 'border-box',
                }}
            >
                {this.props.id}{' '}
                <span>
                    {this.props.width} × {this.props.height}
                </span>
                <button onClick={() => this.props.onStateAndParamsChange({state: {clicked: true}})}>
                    Set state
                </button>
                <button
                    data-qa={`grow-${this.props.id}`}
                    onClick={() => {
                        const layout = requireValue(
                            this.props.layout.find(({i}) => i === this.props.id),
                            'widget layout',
                        );
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
    getMeta = () => Promise.resolve({id: this.props.id, identity: this.identity});
    reload = () => undefined;
}
DashKitGridStack.reloadPlugins({
    type,
    defaultLayout: {w: 100, h: 80, minW: 20, minH: 20},
    renderer: (props, ref) => <Widget {...props} ref={ref} />,
});

DashKitGridStack.reloadPlugins({
    type: 'gridstack-budget-widget',
    defaultLayout: {w: 4, h: 2, minW: 1, minH: 1},
    renderer: (props, ref) => <Widget {...props} ref={ref} />,
});

const initial: GridStackConfig = {
    salt: 'public-gridstack-contract',
    counter: 1,
    aliases: {},
    connections: [],
    items: ['a', 'b'].map((id) => ({id, type, namespace: 'default', data: {}})),
    layout: [
        {i: 'a', x: 40, y: 40, w: 160, h: 100},
        {i: 'b', x: 120, y: 80, w: 180, h: 120},
    ],
};

function Contract({
    nested = false,
    zones = false,
    dashboard = false,
    occupied = false,
    mode,
    legacy = false,
}: {
    legacy?: boolean;
    nested?: boolean;
    zones?: boolean;
    dashboard?: boolean;
    occupied?: boolean;
    mode?: 'collision' | 'nowrap' | 'custom' | 'edges' | 'scalar' | 'budget' | 'horizontal';
}) {
    const Component = legacy ? DashKit : DashKitGridStack;
    const canvasWidth = zones ? 320 : 640;
    const [config, setConfig] = React.useState<GridStackConfig>(() => {
        if (mode === 'budget' || mode === 'horizontal') {
            return {
                ...initial,
                items: initial.items.map((item) => ({...item, type: 'gridstack-budget-widget'})),
                layout: [
                    {i: 'a', x: 0, y: 0, w: 8, h: 2},
                    {
                        i: 'b',
                        x: mode === 'budget' ? 8 : 0,
                        y: 0,
                        w: mode === 'budget' ? 4 : 6,
                        h: 2,
                    },
                ],
            };
        }
        if (mode === 'collision' || mode === 'nowrap') {
            return {
                ...initial,
                layout:
                    mode === 'collision'
                        ? [
                              {i: 'a', x: 40, y: 40, w: 160, h: 100},
                              {i: 'b', x: 300, y: 40, w: 180, h: 120},
                          ]
                        : [
                              {i: 'a', x: 0, y: 0, w: 160, h: 100},
                              {i: 'b', x: 160, y: 0, w: 180, h: 120},
                          ],
            };
        }
        if (nested) {
            return {
                ...initial,
                layoutVersion: 2,
                containers: [
                    {
                        id: 'panel',
                        x: 340,
                        y: 20,
                        w: 280,
                        h: 260,
                        padding: [12, 20, 24, 16],
                        gap: [8, 6],
                        grid: {cols: 12, rowHeight: 18, compactType: null},
                    },
                ],
            };
        }
        if (zones) {
            return {
                ...initial,
                items: occupied
                    ? [...initial.items, {...initial.items[0], id: 'c'}]
                    : initial.items,
                layout: occupied
                    ? [
                          {i: 'a', x: 20, y: 20, w: 100, h: 80, parent: 'left'},
                          {i: 'b', x: 180, y: 40, w: 100, h: 80, parent: 'left'},
                          {i: 'c', x: 0, y: 0, w: 320, h: 400, parent: 'right'},
                      ]
                    : initial.layout.map((entry) => ({...entry, parent: 'left'})),
            };
        }
        if (dashboard) {
            return {
                ...initial,
                layout: [
                    {i: 'a', x: 0, y: 0, w: 12, h: 4},
                    {i: 'b', x: 12, y: 0, w: 12, h: 4},
                ],
            };
        }
        return initial;
    });
    const [scale, setScale] = React.useState(1);
    const [editing, setEditing] = React.useState(!dashboard);
    const [allowPalette, setAllowPalette] = React.useState(true);
    const [silent, setSilent] = React.useState(false);
    const [focused, setFocused] = React.useState<string | null>(null);
    const [events, setEvents] = React.useState(0);
    const callbacks = React.useRef<
        Array<{
            phase: string;
            group?: string;
            ids: string[];
            old?: unknown;
            next?: unknown;
            placeholder?: unknown;
        }>
    >([]);
    const [states, setStates] = React.useState({});
    const [meta, setMeta] = React.useState<unknown[]>([]);
    const [drops, setDrops] = React.useState(0);
    const ref = React.useRef<(DashKitLayoutRef & Pick<DashKit, 'on'>) | null>(null);
    const lastConfig = React.useRef(config);
    const previous = React.useRef(config);
    const scaleRef = React.useRef(scale);
    const canvas = React.useRef<HTMLDivElement>(null);
    React.useLayoutEffect(() => {
        scaleRef.current = scale;
    }, [scale]);
    React.useEffect(
        () =>
            ref.current?.on('change', (event) => {
                setEvents((count) => count + 1);
                lastConfig.current = {
                    ...lastConfig.current,
                    layout: event.layout,
                    ...(event.containers ? {containers: event.containers, layoutVersion: 2} : {}),
                };
                if (silent) {
                    event.preventDefault();
                }
            }),
        [silent],
    );
    const groups = React.useMemo<DashKitGroup[]>(
        () =>
            (zones ? ['left', 'right'] : ['__default']).map((id) => ({
                id,
                render: zones
                    ? (groupId, children) => (
                          <div
                              key={groupId}
                              style={{display: 'inline-block', verticalAlign: 'top', width: 320}}
                          >
                              {children}
                          </div>
                      )
                    : undefined,
                gridProperties: () => {
                    if (mode === 'budget' || mode === 'horizontal') {
                        return {
                            cols: 12,
                            rowHeight: 18,
                            margin: [8, 6],
                            containerPadding: [0, 0],
                            compactType: mode === 'budget' ? 'horizontal-nowrap' : 'horizontal',
                            maxRows: mode === 'budget' ? 4 : 10,
                            autoSize: false,
                            style: {height: 234},
                            resizeHandles: ['se'],
                        };
                    }
                    if (dashboard) {
                        return {cols: 36, rowHeight: 18, margin: [8, 8], containerPadding: [0, 0]};
                    }
                    return {
                        cols: zones ? 320 : 640,
                        rowHeight: 1,
                        margin: [0, 0] as [number, number],
                        containerPadding: [0, 0] as [number, number],
                        compactType: mode === 'nowrap' ? 'horizontal-nowrap' : null,
                        autoSize: false,
                        allowOverlap: !occupied && mode !== 'collision' && mode !== 'nowrap',
                        preventCollision: occupied || mode === 'collision',
                        maxRows: 400,
                        width: zones ? 320 : 640,
                        isBounded: !zones,
                        style: {height: 400},
                        resizeHandles: (mode === 'edges'
                            ? ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']
                            : ['nw', 'ne', 'sw', 'se']) as (
                            | 'n'
                            | 's'
                            | 'e'
                            | 'w'
                            | 'nw'
                            | 'ne'
                            | 'sw'
                            | 'se'
                        )[],
                        transformScaleRef: mode === 'scalar' ? undefined : scaleRef,
                        transformScale: mode === 'scalar' ? scale : undefined,
                        ...(mode === 'custom'
                            ? {
                                  resizeHandle: (
                                      direction: string,
                                      handleRef?: React.Ref<HTMLSpanElement>,
                                  ) => (
                                      <span
                                          ref={handleRef}
                                          className={`react-resizable-handle react-resizable-handle-${direction}`}
                                          data-custom-handle={direction}
                                          style={{
                                              display: 'block',
                                              width: 16,
                                              height: 16,
                                              background: '#5169d4',
                                          }}
                                      />
                                  ),
                              }
                            : {}),
                        onLayoutChange: (layout) =>
                            callbacks.current.push({
                                phase: 'grid',
                                group: id,
                                ids: layout.map(({i}) => i),
                            }),
                    };
                },
            })),
        [zones, dashboard, mode, scale, occupied],
    );
    return (
        <DashKitDnDWrapper
            onDropDragOver={(item) =>
                allowPalette &&
                !(occupied && item.parent === 'right' && config.items.some(({id}) => id === 'c'))
            }
        >
            <div>
                <div
                    style={{
                        display: 'flex',
                        gap: 12,
                        marginBottom: 16,
                        flexWrap: mode === 'budget' || mode === 'horizontal' ? 'wrap' : undefined,
                    }}
                >
                    {occupied && (
                        <button
                            onClick={() => {
                                const next = {
                                    ...config,
                                    items: config.items.filter(({id}) => id !== 'c'),
                                    layout: config.layout.filter(({i}) => i !== 'c'),
                                };
                                lastConfig.current = next;
                                setConfig(next);
                            }}
                        >
                            Remove destination blocker
                        </button>
                    )}
                    <button onClick={() => setEditing((value) => !value)}>Toggle edit</button>
                    <input aria-label="Keyboard probe" style={{width: 60}} />
                    <button onClick={() => setScale((value) => (value === 1 ? 0.5 : 1))}>
                        Toggle zoom
                    </button>
                    <button onClick={() => setScale(2)}>Zoom2</button>
                    <button
                        onClick={() => {
                            scaleRef.current = 2;
                            if (canvas.current) {
                                canvas.current.style.transform = 'scale(2)';
                            }
                        }}
                    >
                        Ref2
                    </button>
                    <button
                        onClick={() => {
                            lastConfig.current = previous.current;
                            setConfig(previous.current);
                        }}
                    >
                        Restore
                    </button>
                    <button onClick={() => setSilent((value) => !value)}>
                        Silent: {String(silent)}
                    </button>
                    <button
                        onClick={() =>
                            setConfig((value) => {
                                const next = {...value, items: [...value.items].reverse()};
                                lastConfig.current = next;
                                return next;
                            })
                        }
                    >
                        Reverse layers
                    </button>
                    <button onClick={() => setAllowPalette((value) => !value)}>
                        Palette allowed: {String(allowPalette)}
                    </button>
                    {(mode === 'budget' || mode === 'horizontal') && (
                        <>
                            <button
                                onClick={() => {
                                    const next = {
                                        ...config,
                                        items: config.items.filter(({id}) => id !== 'b'),
                                        layout: config.layout.filter(({i}) => i !== 'b'),
                                    };
                                    lastConfig.current = next;
                                    setConfig(next);
                                }}
                            >
                                Remove b
                            </button>
                            <button
                                onClick={() => {
                                    const next = {
                                        ...config,
                                        layout: Component.reflowLayout({
                                            layout: config.layout,
                                            groups,
                                        }),
                                    };
                                    lastConfig.current = next;
                                    setConfig(next);
                                }}
                            >
                                Compact
                            </button>
                            <pre data-qa="legacy-reflow">
                                {JSON.stringify(
                                    DashKit.reflowLayout({
                                        layout: config.layout.map((entry) => ({...entry})),
                                        groups,
                                    }),
                                )}
                            </pre>
                        </>
                    )}
                    <button
                        onClick={async () =>
                            setMeta(
                                await Promise.all(
                                    requireValue(ref.current, 'DashKit ref').getItemsMeta(),
                                ),
                            )
                        }
                    >
                        Read refs
                    </button>
                    <span data-qa="event-count">Events: {events}</span>
                    <ActionPanel
                        items={[
                            {
                                id: 'palette',
                                icon: '+',
                                title: 'Widget',
                                dragProps:
                                    mode === 'budget' || mode === 'horizontal'
                                        ? {type: 'gridstack-budget-widget', layout: {w: 4, h: 2}}
                                        : {type, layout: {w: 100, h: 80}},
                            },
                        ]}
                    />
                </div>
                <div
                    ref={canvas}
                    data-qa="contract-canvas"
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        width: dashboard ? '100%' : canvasWidth,
                        height: zones ? 800 : 400,
                        outline: '1px solid #666',
                    }}
                >
                    <Component
                        ref={(instance) => {
                            ref.current = instance;
                        }}
                        config={config}
                        editMode={editing}
                        focusable
                        onItemFocus={(item) => setFocused(item.id)}
                        onItemBlur={() => setFocused(null)}
                        groups={groups}
                        itemsStateAndParams={states}
                        onChange={({config: next, itemsStateAndParams}) => {
                            previous.current = config;
                            lastConfig.current = next;
                            setConfig(next);
                            setStates(itemsStateAndParams);
                        }}
                        onDragStart={(event) =>
                            callbacks.current.push({
                                phase: 'start',
                                group: event.group,
                                ids: event.layout.map(({i}) => i),
                                old: event.oldItem,
                                next: event.newItem,
                                placeholder: event.placeholder,
                            })
                        }
                        onDrag={(event) =>
                            callbacks.current.push({
                                phase: 'move',
                                group: event.group,
                                ids: event.layout.map(({i}) => i),
                                old: event.oldItem,
                                next: event.newItem,
                                placeholder: event.placeholder,
                            })
                        }
                        onDragStop={(event) =>
                            callbacks.current.push({
                                phase: 'stop',
                                group: event.group,
                                ids: event.layout.map(({i}) => i),
                                old: event.oldItem,
                                next: event.newItem,
                                placeholder: event.placeholder,
                            })
                        }
                        onDrop={({itemLayout, newLayout, containers, commit, dragProps}) => {
                            setDrops((count) => count + 1);
                            const next = Component.setItem({
                                config: {
                                    ...lastConfig.current,
                                    ...(containers ? {containers} : {}),
                                },
                                item: {type: dragProps.type, data: {}, layout: itemLayout},
                                options: {updateLayout: newLayout},
                                groups,
                            });
                            setConfig(next);
                            lastConfig.current = next;
                            commit();
                        }}
                    />
                </div>
                <span data-qa="focused-item">{focused || ''}</span>
                <pre data-qa="callback-log">{JSON.stringify(callbacks.current)}</pre>
                <pre data-qa="saved-config">{JSON.stringify(lastConfig.current)}</pre>
                <pre data-qa="meta">{JSON.stringify(meta)}</pre>
                <span data-qa="drop-count">{drops}</span>
            </div>
        </DashKitDnDWrapper>
    );
}
export default {
    title: 'Tests/GridStack',
    component: Contract,
    args: {legacy: false, occupied: false},
} as Meta;
export const ReportCanvas: StoryFn<typeof Contract> = (args) => <Contract {...args} />;
export const NestedContainers: StoryFn = () => <Contract nested />;

export const CrossZones: StoryFn<typeof Contract> = (args) => <Contract {...args} zones />;

export const Dashboard: StoryFn<typeof Contract> = (args) => <Contract {...args} dashboard />;
export const Collision: StoryFn<typeof Contract> = (args) => (
    <Contract {...args} mode="collision" />
);
export const HorizontalNowrap: StoryFn<typeof Contract> = (args) => (
    <Contract {...args} mode="nowrap" />
);
export const CustomHandles: StoryFn<typeof Contract> = (args) => (
    <Contract {...args} mode="custom" />
);
export const AllHandles: StoryFn<typeof Contract> = (args) => <Contract {...args} mode="edges" />;
export const FiniteNowrap: StoryFn<typeof Contract> = (args) => (
    <Contract {...args} mode="budget" />
);
export const HorizontalPacking: StoryFn<typeof Contract> = (args) => (
    <Contract {...args} mode="horizontal" />
);

export const ScalarZoom: StoryFn<typeof Contract> = (args) => <Contract {...args} mode="scalar" />;

export const HeightCompatibility: StoryFn = () => {
    const document: GridStackConfig = {
        ...initial,
        items: [initial.items[0]],
        layout: [{i: 'a', parent: 'short', x: 0, y: 0, w: 3, h: 1}],
    };
    const groups: DashKitGroup[] = ['short', 'empty'].map((id) => ({
        id,
        gridProperties: () => ({
            cols: 12,
            rowHeight: 18,
            maxRows: 100,
            compactType: null,
            margin: [8, 6],
            containerPadding: [16, 12],
            width: 640,
        }),
        render: (key, children) => (
            <section key={key} data-height-zone={key}>
                {children}
            </section>
        ),
    }));
    return (
        <div style={{width: 640}}>
            <div data-height-engine="legacy">
                <DashKit config={document} groups={groups} editMode={false} />
            </div>
            <div data-height-engine="gridstack">
                <DashKitGridStack config={document} groups={groups} editMode={false} />
            </div>
        </div>
    );
};

function PortalZone({explicit = false, fixed = false}: {explicit?: boolean; fixed?: boolean}) {
    const [target, setTarget] = React.useState<HTMLDivElement | null>(null);
    const [pinned, setPinned] = React.useState(false);
    const [events, setEvents] = React.useState(0);
    const parent = pinned ? 'fixed' : 'main';
    const config = React.useMemo<GridStackConfig>(
        () => ({
            ...initial,
            layoutVersion: 2,
            layout: [
                {i: 'a', parent, x: 0, y: 0, w: 3, h: 2, minW: 1, minH: 1},
                {i: 'b', parent, containerId: 'panel', x: 0, y: 0, w: 6, h: 2, minW: 1, minH: 1},
            ],
            containers: [
                {
                    id: 'panel',
                    parent,
                    x: 4,
                    y: 0,
                    w: 6,
                    h: 6,
                    padding: [3, 7, 5, 11],
                    gap: [4, 2],
                    grid: {cols: 12, rowHeight: 18, compactType: null},
                },
            ],
        }),
        [parent],
    );
    const groups = React.useMemo<DashKitGroup[]>(
        () =>
            ['main', ...(pinned ? ['fixed'] : [])].map((id) => ({
                id,
                gridProperties: () => ({
                    cols: 12,
                    rowHeight: 18,
                    compactType: null,
                    margin: [8, 6],
                    containerPadding: [0, 0],
                    autoSize: !fixed,
                    ...(explicit ? {width: 384} : {}),
                    style: {height: fixed ? 180 : undefined, ...(explicit ? {width: 384} : {})},
                }),
                render: (key, children) =>
                    id === 'fixed' && target ? (
                        createPortal(children, target, key)
                    ) : (
                        <section key={key} data-main-zone>
                            {children}
                        </section>
                    ),
            })),
        [explicit, fixed, pinned, target],
    );
    return (
        <section
            data-portal-case={`${explicit ? 'explicit' : 'fluid'}-${fixed ? 'fixed' : 'auto'}`}
            style={{width: 640}}
        >
            <button onClick={() => setPinned((value) => !value)}>Toggle pin</button>
            <span data-portal-events>{events}</span>
            <div data-portal-frame style={{display: 'flex', width: '100%'}}>
                <aside style={{width: 80, flexShrink: 0}}>Header</aside>
                <div data-portal-flex-item style={{flex: 1}}>
                    <div ref={setTarget} data-portal-target />
                </div>
            </div>
            <DashKitGridStack
                config={config}
                groups={groups}
                editMode={false}
                onChange={() => setEvents((value) => value + 1)}
            />
        </section>
    );
}

export const PortalFlexZones: StoryFn = () => (
    <>
        <PortalZone />
        <PortalZone fixed />
        <PortalZone explicit />
        <PortalZone explicit fixed />
    </>
);

export const BoundedSubtrees: StoryFn = () => {
    const [config, setConfig] = React.useState<GridStackConfig>({
        ...initial,
        items: initial.items.map((item) => ({...item, type: 'gridstack-budget-widget'})),
        layoutVersion: 2,
        layout: [
            {
                i: 'a',
                parent: 'left',
                containerId: 'small',
                x: 0,
                y: 0,
                w: 6,
                h: 2,
            },
            {i: 'b', parent: 'left', containerId: 'twig', x: 0, y: 0, w: 3, h: 2},
        ],
        containers: [
            {
                id: 'target',
                parent: 'right',
                x: 0,
                y: 0,
                w: 12,
                h: 10,
                padding: [0, 0, 0, 0],
                gap: [0, 0],
                grid: {cols: 12, rowHeight: 18, compactType: null, maxRows: 10},
            },
            {
                id: 'small',
                parent: 'left',
                x: 20,
                y: 20,
                w: 80,
                h: 80,
                padding: [4, 6, 8, 10],
                gap: [4, 2],
                grid: {cols: 12, rowHeight: 18, compactType: null},
            },
            {
                id: 'twig',
                parent: 'left',
                containerId: 'small',
                x: 6,
                y: 0,
                w: 6,
                h: 2,
                padding: [0, 0, 0, 0],
                gap: [0, 0],
                grid: {cols: 6, rowHeight: 10, compactType: null},
            },
            {
                id: 'large',
                parent: 'left',
                x: 10,
                y: 180,
                w: 300,
                h: 190,
                padding: [0, 0, 0, 0],
                gap: [0, 0],
                grid: {cols: 12, rowHeight: 18, compactType: null},
            },
        ],
    });
    const [allowPalette, setAllowPalette] = React.useState(true);
    const [drops, setDrops] = React.useState(0);
    const previous = React.useRef(config);
    const [events, setEvents] = React.useState(0);
    const [meta, setMeta] = React.useState<unknown[]>([]);
    const ref = React.useRef<DashKitGridStack>(null);
    const groups = React.useMemo<DashKitGroup[]>(
        () =>
            ['left', 'right'].map((id) => ({
                id,
                render: (key, children) => (
                    <section
                        key={key}
                        data-boundary-zone={id}
                        style={{
                            display: 'inline-block',
                            verticalAlign: 'top',
                            width: id === 'left' ? 320 : 280,
                            marginRight: id === 'left' ? 40 : 0,
                        }}
                    >
                        {children}
                    </section>
                ),
                gridProperties: () => ({
                    cols: id === 'left' ? 320 : 12,
                    rowHeight: id === 'left' ? 1 : 18,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                    autoSize: false,
                    maxRows: id === 'left' ? 400 : 10,
                    isBounded: true,
                    style: {height: id === 'left' ? 400 : 180},
                    resizeHandles: ['nw', 'ne', 'sw', 'se'],
                }),
            })),
        [],
    );
    return (
        <DashKitDnDWrapper onDropDragOver={() => allowPalette}>
            <div style={{width: 640}}>
                <button onClick={() => setAllowPalette((value) => !value)}>
                    Palette allowed: {String(allowPalette)}
                </button>
                <ActionPanel
                    items={[
                        {
                            id: 'palette',
                            icon: '+',
                            title: 'Widget',
                            dragProps: {type: 'gridstack-budget-widget', layout: {w: 4, h: 2}},
                        },
                    ]}
                />
                <button onClick={() => setConfig(previous.current)}>Undo subtree</button>
                <button
                    onClick={async () =>
                        setMeta(
                            await Promise.all(
                                requireValue(ref.current, 'DashKit ref').getItemsMeta(),
                            ),
                        )
                    }
                >
                    Read refs
                </button>
                <span data-qa="event-count">Events: {events}</span>
                <DashKitGridStack
                    ref={ref}
                    config={config}
                    groups={groups}
                    editMode
                    onDrop={({itemLayout, newLayout, containers, commit, dragProps}) => {
                        const next = DashKitGridStack.setItem({
                            config: {...config, ...(containers ? {containers} : {})},
                            item: {type: dragProps.type, data: {}, layout: itemLayout},
                            options: {updateLayout: newLayout},
                            groups,
                        });
                        previous.current = config;
                        setConfig(next);
                        setDrops((count) => count + 1);
                        commit();
                    }}
                    onChange={({config: next}) => {
                        previous.current = config;
                        setConfig(next);
                        setEvents((count) => count + 1);
                    }}
                />
                <pre data-qa="saved-config">{JSON.stringify(config)}</pre>
                <pre data-qa="meta">{JSON.stringify(meta)}</pre>
                <span data-qa="drop-count">{drops}</span>
            </div>
        </DashKitDnDWrapper>
    );
};

export const ConvertedFit: StoryFn = () => {
    const [config, setConfig] = React.useState<GridStackConfig>({
        ...initial,
        items: initial.items.map((item) => ({...item, type: 'gridstack-budget-widget'})),
        layout: [
            {i: 'a', parent: 'left', x: 0, y: 0, w: 10, h: 10},
            {i: 'b', parent: 'right', x: 0, y: 5, w: 12, h: 5},
        ],
    });
    const [events, setEvents] = React.useState(0);
    const groups = React.useMemo<DashKitGroup[]>(
        () =>
            ['left', 'right'].map((id) => ({
                id,
                render: (key, children) => (
                    <section
                        key={key}
                        data-fit-zone={id}
                        style={{display: 'inline-block', width: 240}}
                    >
                        {children}
                    </section>
                ),
                gridProperties: () => ({
                    cols: 12,
                    rowHeight: id === 'left' ? 4 : 10,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                    autoSize: false,
                    maxRows: id === 'left' ? 40 : 10,
                    isBounded: true,
                    style: {height: id === 'left' ? 160 : 100},
                }),
            })),
        [],
    );
    return (
        <DashKitDnDWrapper>
            <div>
                <DashKitGridStack
                    config={config}
                    groups={groups}
                    editMode
                    onChange={({config: next}) => {
                        setConfig(next);
                        setEvents((count) => count + 1);
                    }}
                />
                <span data-qa="event-count">Events: {events}</span>
                <pre data-qa="saved-config">{JSON.stringify(config)}</pre>
            </div>
        </DashKitDnDWrapper>
    );
};

function StrictLifecycleFixture(args: React.ComponentProps<typeof Contract>) {
    const [mounted, setMounted] = React.useState(true);
    return (
        <>
            <button onClick={() => setMounted((value) => !value)}>Toggle mount</button>
            <React.StrictMode>{mounted ? <Contract {...args} /> : null}</React.StrictMode>
        </>
    );
}
export const StrictLifecycle: StoryFn<typeof Contract> = (args) => (
    <StrictLifecycleFixture {...args} />
);

export const LegacyScaleContinuation: StoryFn = () => <Contract legacy />;

export const NestedBounds: StoryFn = () => {
    const [config, setConfig] = React.useState<GridStackConfig>({
        ...initial,
        items: [{...initial.items[1], type: 'gridstack-budget-widget'}],
        layout: [{i: 'b', x: 2, y: 2, w: 4, h: 3, containerId: 'panel'}],
        layoutVersion: 2,
        containers: [
            {
                id: 'panel',
                x: 100,
                y: 20,
                w: 280,
                h: 260,
                padding: [12, 20, 24, 16],
                gap: [8, 6],
                grid: {cols: 12, rowHeight: 18, compactType: null, allowOverlap: true},
            },
        ],
    });
    const previous = React.useRef(config);
    const [events, setEvents] = React.useState(0);
    const [drops, setDrops] = React.useState(0);
    const [hidden, setHidden] = React.useState(false);
    const groups = React.useMemo<DashKitGroup[]>(
        () => [
            {
                gridProperties: () => ({
                    cols: 640,
                    rowHeight: 1,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                    allowOverlap: true,
                    autoSize: false,
                    maxRows: 400,
                    isBounded: true,
                    style: {height: 400},
                    resizeHandles: ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'],
                }),
            },
        ],
        [],
    );
    return (
        <DashKitDnDWrapper>
            <div style={{width: 640}}>
                {[6, 100].map((maxRows) => (
                    <button
                        key={maxRows}
                        onClick={() =>
                            setConfig((value) => ({
                                ...value,
                                containers: requireValue(value.containers, 'saved containers').map(
                                    (container) => ({
                                        ...container,
                                        grid: {...container.grid, maxRows},
                                    }),
                                ),
                            }))
                        }
                    >
                        Cap {maxRows}
                    </button>
                ))}
                <button
                    onClick={() =>
                        setConfig((value) => ({
                            ...value,
                            layout: [
                                {
                                    ...value.layout[0],
                                    x: 0.25,
                                    y: 1.25,
                                    w: 3.5,
                                    h: 8,
                                },
                            ],
                        }))
                    }
                >
                    Fractional child
                </button>
                {[6, 18].map((height) => (
                    <button
                        key={height}
                        onClick={() =>
                            setConfig((value) => ({
                                ...value,
                                items: [],
                                layout: [],
                                containers: requireValue(value.containers, 'saved containers').map(
                                    (container) => ({
                                        ...container,
                                        h: 36 + height,
                                    }),
                                ),
                            }))
                        }
                    >
                        Empty content {height}
                    </button>
                ))}
                <button onClick={() => setConfig(previous.current)}>Restore</button>
                <button onClick={() => setHidden((value) => !value)}>Toggle hidden</button>
                <span data-qa="event-count">Events: {events}</span>
                <span data-qa="drop-count">{drops}</span>
                <ActionPanel
                    items={[
                        {
                            id: 'palette',
                            icon: '+',
                            title: 'Widget',
                            dragProps: {type: 'gridstack-budget-widget', layout: {w: 64, h: 48}},
                        },
                    ]}
                />
                <div style={{height: 400, display: hidden ? 'none' : undefined}}>
                    <DashKitGridStack
                        config={config}
                        groups={groups}
                        editMode
                        onChange={({config: next}) => {
                            previous.current = config;
                            setConfig(next);
                            setEvents((count) => count + 1);
                        }}
                        onDrop={({itemLayout, newLayout, containers, commit, dragProps}) => {
                            previous.current = config;
                            setConfig(
                                DashKitGridStack.setItem({
                                    config: {...config, ...(containers ? {containers} : {})},
                                    groups,
                                    item: {type: dragProps.type, data: {}, layout: itemLayout},
                                    options: {updateLayout: newLayout},
                                }),
                            );
                            setDrops((count) => count + 1);
                            commit();
                        }}
                    />
                </div>
                <pre data-qa="saved-config">{JSON.stringify(config)}</pre>
            </div>
        </DashKitDnDWrapper>
    );
};

export const PreviewOverlap: StoryFn<typeof PreviewOverlapFixture> = (args) => (
    <PreviewOverlapFixture {...args} />
);
PreviewOverlap.args = {nested: false, allowOverlap: false, compactType: null};

export {PaletteDocument};
export const PaletteAdmission: StoryFn = () => <PaletteDocument admission />;
