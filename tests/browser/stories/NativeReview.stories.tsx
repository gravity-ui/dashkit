import React from 'react';

import type {Meta, StoryFn} from '@storybook/react';

import {DashKitDnDWrapper} from '../../../src/components/DashKitDnDWrapper/DashKitDnDWrapper';
import {DashKitGridStack} from '../../../src/gridstack';
import type {Config} from '../../../src/shared';
import type {DashKitGroup} from '../../../src/typings';

const type = 'native-review-widget';
DashKitGridStack.reloadPlugins({
    type,
    defaultLayout: {w: 2, h: 4, minW: 1, minH: 1},
    renderer: (props) => (
        <div
            data-review-widget={props.id}
            style={{width: '100%', height: '100%', background: '#dcecff'}}
        >
            {props.id}
        </div>
    ),
});
type Mode = 'bounded' | 'nested' | 'nowrap' | 'fractional' | 'occupied' | 'subtree';
function NativeReview({mode}: {mode: Mode}) {
    const fractional = mode === 'fractional';
    const [config, setConfig] = React.useState<Config>(() => ({
        salt: 'native-review',
        counter: 1,
        aliases: {},
        connections: [],
        items: ['a', 'b'].map((id) => ({id, type, namespace: 'default', data: {}})),
        layout: [
            {
                i: 'a',
                parent: 'left',
                x: 0,
                y: 0,
                w: mode === 'occupied' ? 6 : fractional ? 4 : 2,
                h: 4,
                ...(fractional ? {minW: 4, maxW: 6, minH: 4, maxH: 6} : {}),
                ...(mode === 'subtree' ? {w: 1, h: 1, containerId: 'small'} : {}),
            },
            {
                i: 'b',
                parent: 'right',
                x: 0,
                y: mode === 'occupied' ? 4 : 0,
                w: mode === 'nowrap' ? 11 : 6,
                h: mode === 'occupied' ? 4 : 2,
                ...(['occupied', 'nested'].includes(mode) ? {containerId: 'target'} : {}),
                ...(mode === 'subtree'
                    ? {parent: 'left', x: 0, y: 0, w: 1, h: 1, containerId: 'twig'}
                    : {}),
            },
        ],
        ...(['nested', 'occupied', 'subtree'].includes(mode)
            ? {
                  layoutVersion: 2 as const,
                  containers: [
                      {
                          id: 'target',
                          parent: 'right',
                          x: 0,
                          y: 0,
                          w: mode === 'occupied' ? 6 : 12,
                          h: mode === 'occupied' ? 8 : 12,
                          padding: [0, 0, 0, 0] as [number, number, number, number],
                          gap: [0, 0] as [number, number],
                          grid: {
                              cols: mode === 'occupied' ? 6 : 12,
                              rowHeight: 20,
                              compactType: null,
                          },
                      },
                      ...(mode === 'subtree'
                          ? [
                                {
                                    id: 'small',
                                    parent: 'left',
                                    x: 0,
                                    y: 0,
                                    w: 4,
                                    h: 4,
                                    padding: [0, 0, 0, 0] as [number, number, number, number],
                                    gap: [0, 0] as [number, number],
                                    grid: {cols: 4, rowHeight: 20, compactType: null},
                                },
                                {
                                    id: 'twig',
                                    parent: 'left',
                                    containerId: 'small',
                                    x: 2,
                                    y: 0,
                                    w: 2,
                                    h: 2,
                                    padding: [0, 0, 0, 0] as [number, number, number, number],
                                    gap: [0, 0] as [number, number],
                                    grid: {cols: 2, rowHeight: 20, compactType: null},
                                },
                            ]
                          : []),
                  ],
              }
            : {}),
    }));
    const [events, setEvents] = React.useState(0);
    const [veto, setVeto] = React.useState(mode === 'subtree');
    const admission = React.useRef<unknown[]>([]);
    const [seen, setSeen] = React.useState<unknown[]>([]);
    const groups: DashKitGroup[] = ['left', 'right'].map((id) => ({
        id,
        gridProperties: () => ({
            cols: 12,
            width: fractional ? (id === 'left' ? 240 : 280) : 600,
            rowHeight: fractional ? (id === 'left' ? 20 : 70 / 3) : 20,
            margin: [0, 0],
            containerPadding: [0, 0],
            compactType: mode === 'nowrap' && id === 'right' ? 'horizontal-nowrap' : null,
            isBounded: mode !== 'nowrap',
            allowOverlap: ['nested', 'occupied', 'subtree'].includes(mode),
            autoSize: false,
            style: {height: 400},
        }),
        render: (key, children) => (
            <section
                data-review-zone={key}
                key={key}
                style={{
                    display: 'inline-block',
                    verticalAlign: 'top',
                    width: fractional ? (id === 'left' ? 240 : 280) : 600,
                    height: 400,
                    marginRight: 20,
                }}
            >
                {children}
            </section>
        ),
    }));
    return (
        <DashKitDnDWrapper
            onDropDragOver={(item) => {
                admission.current.push(item);
                return !(veto && item.i === 'b' && item.parent === 'right');
            }}
        >
            <div>
                <button onClick={() => setVeto(false)}>Allow subtree</button>
                <button onClick={() => setSeen([...admission.current])}>Read admission</button>
                <div style={{width: 1260}}>
                    <DashKitGridStack
                        config={config}
                        groups={groups}
                        editMode
                        noOverlay
                        onChange={({config: next}) => {
                            setConfig(next);
                            setEvents((n) => n + 1);
                        }}
                    />
                </div>
                <pre data-qa="review-config">{JSON.stringify(config)}</pre>
                <span data-qa="review-events">{events}</span>
                <pre data-qa="review-admission">{JSON.stringify(seen)}</pre>
            </div>
        </DashKitDnDWrapper>
    );
}
export default {title: 'Tests/Native Review'} as Meta;
export const Bounded: StoryFn = () => <NativeReview mode="bounded" />;
export const Nested: StoryFn = () => <NativeReview mode="nested" />;
export const Nowrap: StoryFn = () => <NativeReview mode="nowrap" />;
export const Fractional: StoryFn = () => <NativeReview mode="fractional" />;
export const Occupied: StoryFn = () => <NativeReview mode="occupied" />;
export const Subtree: StoryFn = () => <NativeReview mode="subtree" />;
