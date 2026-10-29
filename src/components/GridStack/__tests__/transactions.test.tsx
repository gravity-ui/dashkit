/** @jest-environment jsdom */
jest.mock('@gravity-ui/icons', () => ({Ellipsis: 'ellipsis', Gear: 'gear', Xmark: 'xmark'}));
jest.mock('@gravity-ui/uikit', () => {
    const ReactMock = require('react');
    return {
        Button: ({children}: {children?: unknown}) =>
            ReactMock.createElement('button', null, children),
        DropdownMenu: ({items}: {items: Array<{text: string; action: () => void; qa?: string}>}) =>
            ReactMock.createElement(
                'div',
                null,
                items.map((item, index) =>
                    ReactMock.createElement(
                        'button',
                        {key: index, onClick: item.action, 'data-qa': item.qa},
                        item.text,
                    ),
                ),
            ),
        Icon: () => null,
    };
});

import React from 'react';

import {act, render} from '@testing-library/react';

import {DEFAULT_GROUP} from '../../../constants';
import type {Config, GridStackContainer} from '../../../shared';
import type {DashKitGroup, PluginWidgetProps} from '../../../typings';
import {DashKitDnDWrapper} from '../../DashKitDnDWrapper/DashKitDnDWrapper';
import {DashKitGridStack} from '../DashKitGridStack';
import {requireValue} from '../invariants';
import {GridStack} from '../runtime';
import type {GridItemHTMLElement} from '../runtime';

const type = 'gridstack-mounted-contract';
const box: GridStackContainer = {
    id: 'box',
    x: 0,
    y: 0,
    w: 12,
    h: 10,
    padding: [10, 20, 30, 40],
    gap: [8, 6],
    grid: {cols: 12, rowHeight: 18, compactType: null},
};
const config: Config = {
    salt: 'test',
    counter: 1,
    aliases: {},
    connections: [],
    items: [{id: 'a', type, namespace: 'default', data: {text: 'retained'}}],
    layout: [{i: 'a', x: 0, y: 0, w: 6, h: 4}],
    containers: [box],
    layoutVersion: 2,
};
let nextInstance = 0;
class Plugin extends React.Component<PluginWidgetProps> {
    identity = ++nextInstance;
    render() {
        return (
            <button
                data-identity={this.identity}
                onClick={() => this.props.onStateAndParamsChange({state: {clicked: true}})}
            >
                {this.props.data.text as string}
            </button>
        );
    }
    getMeta = () => Promise.resolve({identity: this.identity});
}
beforeAll(() => {
    DashKitGridStack.reloadPlugins({
        type,
        defaultLayout: {w: 6, h: 4},
        renderer: (props, ref) => <Plugin {...props} ref={ref} />,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get: () => 640,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get: () => 400,
    });
});

// Critical: yes. Moving a full nowrap subtree must preserve its children and honor destination admission.
test.each([1, 2])(
    'native nowrap subtree move checks each child once with %s children',
    async (count) => {
        const groups: DashKitGroup[] = ['left', 'right'].map((id) => ({
            id,
            render: (key, children) => (
                <section key={key} data-zone={id}>
                    {children}
                </section>
            ),
            gridProperties: () => ({
                cols: 12,
                rowHeight: 20,
                margin: [0, 0],
                containerPadding: [0, 0],
                compactType: null,
            }),
        }));
        const childType = 'nowrap-subtree-child';
        DashKitGridStack.reloadPlugins({
            type: childType,
            defaultLayout: {w: 6, h: 2, minW: 1},
            renderer: (props, ref) => <Plugin {...props} ref={ref} />,
        });
        const nested: Config = {
            ...config,
            items: Array.from({length: count}, (_, index) => ({
                ...config.items[0],
                type: childType,
                id: `child-${index}`,
            })),
            layout: Array.from({length: count}, (_, index) => ({
                i: `child-${index}`,
                parent: 'left',
                containerId: 'box',
                x: (index * 6) / count,
                y: 0,
                w: 6 / count,
                h: 2,
            })),
            containers: [
                {
                    ...box,
                    parent: 'left',
                    w: 6,
                    h: 6,
                    padding: [0, 0, 0, 0],
                    gap: [0, 0],
                    grid: {cols: 6, rowHeight: 20, compactType: 'horizontal-nowrap'},
                },
            ],
        };
        const before = JSON.stringify(nested);
        const onChange = jest.fn();
        let veto = false;
        const admission = jest.fn(() => !veto);
        const measured = jest
            .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
            .mockImplementation(function (this: HTMLElement) {
                return this.closest('[data-dashkit-id="box"]') ? 320 : 640;
            });
        const view = render(
            <DashKitDnDWrapper onDropDragOver={admission}>
                <DashKitGridStack config={nested} groups={groups} editMode onChange={onChange} />
            </DashKitDnDWrapper>,
        );
        try {
            const host = requireValue(
                view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="box"]'),
                'container host',
            );
            const plugins = [...host.querySelectorAll('[data-identity]')];
            expect(plugins).toHaveLength(count);
            const node = requireValue(host.gridstackNode, 'container node');
            const source = requireValue(node.grid, 'source grid') as GridStack & {
                triggerEvent(event: Event, target: HTMLElement): void;
            };
            const target = requireValue(
                view.container.querySelector<HTMLElement>('[data-zone="right"] .grid-stack'),
                'destination grid',
            ) as HTMLElement & {
                gridstack: GridStack;
                ddElement: {ddDroppable: {option: {accept(el: Element): boolean}}};
            };
            const accept = target.ddElement.ddDroppable.option.accept;
            expect(accept(host)).toBe(true);
            expect(admission).toHaveBeenCalledTimes(count);
            for (let index = 0; index < count; index++) {
                expect(admission.mock.calls[index]).toEqual([
                    expect.objectContaining({
                        ...nested.layout[index],
                        parent: 'right',
                        type: childType,
                    }),
                    expect.objectContaining({...nested.layout[index], type: childType}),
                ]);
            }
            veto = true;
            admission.mockClear();
            expect(accept(host)).toBe(false);
            expect(admission).toHaveBeenCalledTimes(1);
            expect(onChange).not.toHaveBeenCalled();
            veto = false;
            expect(accept(host)).toBe(true);
            await act(async () => {
                source.triggerEvent(new Event('dragstart'), host);
                source.engine.removeNode(node);
                target.appendChild(host);
                node.grid = target.gridstack;
                target.gridstack.engine.addNode(node);
                source.triggerEvent(new Event('dragstop'), host);
                await Promise.resolve();
            });
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange.mock.calls[0][0].config.layout).toEqual(
                nested.layout.map((entry) => ({...entry, parent: 'right'})),
            );
            expect(onChange.mock.calls[0][0].config.containers).toEqual(
                nested.containers?.map((entry) => ({...entry, parent: 'right'})),
            );
            plugins.forEach((plugin, index) => {
                expect(host.querySelectorAll('[data-identity]')[index]).toBe(plugin);
            });
            expect(JSON.stringify(nested)).toBe(before);
        } finally {
            view.unmount();
            measured.mockRestore();
        }
    },
);

// Critical: yes. Two dashboard instances may use the same saved widget ID.
test('native admission rejects a foreign instance host with the same widget ID', () => {
    const onChange = jest.fn();
    const view = render(
        <>
            <div data-testid="target">
                <DashKitGridStack config={config} editMode onChange={onChange} />
            </div>
            <div data-testid="foreign">
                <DashKitGridStack config={config} editMode onChange={onChange} />
            </div>
        </>,
    );
    const target = view.getByTestId('target');
    const foreign = view.getByTestId('foreign');
    const root = target.querySelector('.grid-stack') as HTMLElement & {
        ddElement: {ddDroppable: {option: {accept: (el: Element) => boolean}}};
    };
    const ownHost = requireValue(target.querySelector('[data-dashkit-id="a"]'), 'own host');
    const foreignHost = requireValue(
        foreign.querySelector('[data-dashkit-id="a"]'),
        'foreign host',
    );
    const accept = root.ddElement.ddDroppable.option.accept;
    expect(accept(foreignHost)).toBe(false);
    expect(accept(ownHost)).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    view.unmount();
});

// Critical: yes. Rounding converted bounds can make a valid source interval impossible.
test.each(['width', 'height'] as const)(
    'native admission rejects inverted converted %s bounds before touching drop state',
    (axis) => {
        const onChange = jest.fn();
        const groups: DashKitGroup[] = [
            {
                id: 'source',
                gridProperties: (properties) => ({
                    ...properties,
                    width: 640,
                    cols: 64,
                    rowHeight: 10,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                }),
            },
        ];
        const invalid = {
            i: 'a',
            parent: 'source',
            x: 0,
            y: 0,
            w: 3,
            h: 3,
            minW: axis === 'width' ? 3 : 1,
            maxW: axis === 'width' ? 3 : 5,
            minH: axis === 'height' ? 3 : 1,
            maxH: axis === 'height' ? 3 : 5,
        };
        const valid = {...invalid, i: 'b', x: 5, minW: 1, maxW: 5, minH: 1, maxH: 5};
        const document: Config = {
            ...config,
            containers: [
                {
                    ...box,
                    id: 'target',
                    parent: 'source',
                    x: 20,
                    w: 30,
                    h: 10,
                    padding: [0, 0, 0, 0],
                    gap: [0, 0],
                    grid: {cols: 32, rowHeight: 20, compactType: null},
                },
            ],
            items: [config.items[0], {...config.items[0], id: 'b'}],
            layout: [invalid, valid],
        };
        const view = render(
            <DashKitGridStack config={document} editMode groups={groups} onChange={onChange} />,
        );
        const root = view.container.querySelector(
            '[data-dashkit-id="target"] .grid-stack',
        ) as HTMLElement & {
            ddElement: {ddDroppable: {option: {accept: (el: Element) => boolean}}};
            gridstack: GridStack;
        };
        const accept = root.ddElement.ddDroppable.option.accept;
        const fit = jest.spyOn(root.gridstack.engine, 'willItFit');
        const invalidHost = requireValue(
            view.container.querySelector('[data-dashkit-id="a"]'),
            'invalid',
        );
        const validHost = requireValue(
            view.container.querySelector('[data-dashkit-id="b"]'),
            'valid',
        );
        const engine = root.gridstack.engine as GridStack['engine'] & {dropSize?: unknown};
        expect(root.gridstack.engine.column).toBe(32);
        expect(accept(validHost)).toBe(true);
        expect(engine.dropSize).toBeDefined();
        fit.mockClear();
        expect(accept(invalidHost)).toBe(false);
        expect(fit).not.toHaveBeenCalled();
        expect(engine.dropSize).toBeUndefined();
        expect(accept(validHost)).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
        view.unmount();
        fit.mockRestore();
    },
);

// Critical: no. Requested regression: a destination cell must not exceed the configured maximum.
test.each([
    ['width', 1],
    ['height', 1],
    ['width', undefined],
    ['height', undefined],
] as const)(
    'native admission rejects a subcell %s maximum with minimum %s without mutation',
    async (axis, minimum) => {
        const onChange = jest.fn();
        const groups: DashKitGroup[] = ['source', 'target'].map((id) => ({
            id,
            render: (key, children) => (
                <section key={key} data-zone={id}>
                    {children}
                </section>
            ),
            gridProperties: () => ({
                width: 600,
                cols: id === 'source' ? 60 : 6,
                rowHeight: id === 'source' ? 10 : 100,
                margin: [0, 0],
                containerPadding: [0, 0],
                compactType: null,
            }),
        }));
        const invalid = {
            i: 'a',
            parent: 'source',
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            minW: minimum,
            minH: minimum,
            maxW: axis === 'width' ? 1 : 10,
            maxH: axis === 'height' ? 1 : 10,
        };
        const valid = {...invalid, i: 'b', x: 10, w: 10, h: 10, maxW: 10, maxH: 10};
        const document: Config = {
            ...config,
            containers: [],
            items: [config.items[0], {...config.items[0], id: 'b'}],
            layout: [invalid, valid],
        };
        const before = JSON.stringify(document);
        const view = render(
            <DashKitGridStack config={document} editMode groups={groups} onChange={onChange} />,
        );
        const invalidHost = requireValue(
            view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="a"]'),
            'invalid host',
        );
        const validHost = requireValue(
            view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="b"]'),
            'valid host',
        );
        const source = requireValue(invalidHost.gridstackNode?.grid, 'source grid') as GridStack & {
            triggerEvent(event: Event, target: HTMLElement): void;
        };
        const target = view.container.querySelector(
            '[data-zone="target"] .grid-stack',
        ) as HTMLElement & {
            gridstack: GridStack;
            ddElement: {ddDroppable: {option: {accept(el: Element): boolean}}};
        };
        const engine = target.gridstack.engine as GridStack['engine'] & {dropSize?: unknown};
        const accept = target.ddElement.ddDroppable.option.accept;
        const fit = jest.spyOn(engine, 'willItFit');
        const savedSource = source.save(false);
        const savedTarget = target.gridstack.save(false);
        try {
            expect(accept(validHost)).toBe(true);
            expect(engine.dropSize).toMatchObject({w: 1, h: 1, maxW: 1, maxH: 1});
            fit.mockClear();
            expect(accept(invalidHost)).toBe(false);
            expect(fit).not.toHaveBeenCalled();
            expect(engine.dropSize).toBeUndefined();
            expect(source.save(false)).toEqual(savedSource);
            expect(target.gridstack.save(false)).toEqual(savedTarget);
            expect(JSON.stringify(document)).toBe(before);
            expect(onChange).not.toHaveBeenCalled();
            await act(async () => {
                source.triggerEvent(new Event('dragstart'), validHost);
                expect(accept(validHost)).toBe(true);
                const node = requireValue(validHost.gridstackNode, 'valid node');
                source.engine.removeNode(node);
                target.appendChild(validHost);
                node.grid = target.gridstack;
                node.x = 1;
                target.gridstack.engine.addNode(node);
                source.triggerEvent(new Event('dragstop'), validHost);
                await Promise.resolve();
            });
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange.mock.calls[0][0].config.layout).toEqual([
                {i: 'a', parent: 'source', x: 0, y: 0, w: 1, h: 1},
                {i: 'b', parent: 'target', x: 1, y: 0, w: 1, h: 1},
            ]);
            expect(JSON.stringify(document)).toBe(before);
        } finally {
            view.unmount();
            fit.mockRestore();
        }
    },
);

// Critical: no. Requested regression: zero converted maxima must not remove native resize caps.
test.each(['width', 'height'] as const)(
    'nested subcell %s maximum retains the native resize cap',
    async (axis) => {
        const groups: DashKitGroup[] = [
            {
                id: DEFAULT_GROUP,
                gridProperties: () => ({
                    width: 600,
                    cols: 60,
                    rowHeight: 10,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                }),
            },
        ];
        const nested: Config = {
            ...config,
            containers: [
                {
                    ...box,
                    w: 60,
                    h: 60,
                    padding: [0, 0, 0, 0],
                    gap: [0, 0],
                    grid: {cols: 6, rowHeight: 100, compactType: null},
                },
            ],
            layout: [
                {
                    i: 'a',
                    containerId: 'box',
                    x: 0,
                    y: 0,
                    w: 1,
                    h: 1,
                    ...(axis === 'width' ? {maxW: 1} : {maxH: 1}),
                },
            ],
        };
        const before = JSON.stringify(nested);
        const onChange = jest.fn();
        const view = render(
            <DashKitGridStack config={nested} groups={groups} editMode onChange={onChange} />,
        );
        try {
            const host = requireValue(
                view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="a"]'),
                'nested host',
            );
            const node = requireValue(host.gridstackNode, 'nested node');
            const grid = requireValue(node.grid, 'nested grid') as GridStack & {
                triggerEvent(event: Event, target: HTMLElement): void;
            };
            const saved = grid.save(false);
            await act(async () => {
                grid.triggerEvent(new Event('resizestart'), host);
                grid.engine.moveNodeCheck(node, {
                    w: axis === 'width' ? 3 : 1,
                    h: axis === 'height' ? 3 : 1,
                    resizing: true,
                });
                grid.triggerEvent(new Event('resizestop'), host);
                await Promise.resolve();
            });
            expect(node).toMatchObject({w: 1, h: 1});
            expect(axis === 'width' ? node.maxW : node.maxH).toBe(1);
            expect(grid.save(false)).toEqual(saved);
            expect(onChange).not.toHaveBeenCalled();
            expect(JSON.stringify(nested)).toBe(before);
        } finally {
            view.unmount();
        }
    },
);

// Critical: yes. A move must not reset a plugin's state/ref or lose saved document membership.
// Critical: yes. A valid subtree must reach native fit checks in destination units, not source pixels.
test('native bounded droppable accepts fitting container units and rejects an oversized subtree', () => {
    const measured = jest
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockImplementation(function (this: HTMLElement) {
            return this.closest('[data-dashkit-id="box"]') ? 280 : 640;
        });
    const target = {
        ...box,
        x: 300,
        w: 280,
        h: 300,
        padding: [0, 0, 0, 0] as [number, number, number, number],
        grid: {...box.grid, maxRows: 10},
    };
    const small = {...target, id: 'small', x: 0, w: 80, h: 80};
    const large = {...small, id: 'large', y: 100, w: 300, h: 200};
    const document = {...config, items: [], layout: [], containers: [target, small, large]};
    const view = render(
        <DashKitGridStack
            config={document}
            editMode
            groups={[
                {
                    gridProperties: () => ({
                        cols: 640,
                        rowHeight: 1,
                        margin: [0, 0],
                        containerPadding: [0, 0],
                        compactType: null,
                        maxRows: 400,
                    }),
                },
            ]}
        />,
    );
    const root = view.container.querySelector(
        '[data-dashkit-id="box"] .grid-stack',
    ) as HTMLElement & {ddElement: {ddDroppable: {option: {accept: (el: Element) => boolean}}}};
    expect(
        root.ddElement.ddDroppable.option.accept(
            requireValue(view.container.querySelector('[data-dashkit-id="small"]'), 'widget host'),
        ),
    ).toBe(true);
    expect(
        root.ddElement.ddDroppable.option.accept(
            requireValue(view.container.querySelector('[data-dashkit-id="large"]'), 'widget host'),
        ),
    ).toBe(false);
    view.unmount();
    measured.mockRestore();
});

test.each(['initial', 'controlled'] as const)(
    'impossible %s container spacing is rejected before native update or change callback',
    (phase) => {
        const onChange = jest.fn();
        const invalid = {
            ...config,
            containers: [{...box, padding: [1000, 0, 1000, 0] as [number, number, number, number]}],
        };
        const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        if (phase === 'initial') {
            expect(() =>
                render(<DashKitGridStack config={invalid} editMode onChange={onChange} />),
            ).toThrow('usable width or height');
        } else {
            const view = render(<DashKitGridStack config={config} editMode onChange={onChange} />);
            const root = view.container.querySelector('.grid-stack') as HTMLElement & {
                gridstack: import('../runtime').GridStack;
            };
            const update = jest.spyOn(root.gridstack, 'update');
            expect(() =>
                view.rerender(<DashKitGridStack config={invalid} editMode onChange={onChange} />),
            ).toThrow('usable width or height');
            expect(update).not.toHaveBeenCalled();
        }
        expect(onChange).not.toHaveBeenCalled();
        error.mockRestore();
    },
);

// This checks the native callback seam; actual pointer admission is covered in the browser matrix.
test('native final proposal validation rejects overflow before emitting and retains the next edit', async () => {
    const nested = {...config, layout: [{...config.layout[0], containerId: 'box'}]};
    const onChange = jest.fn();
    const onResizeStop = jest.fn();
    const view = render(
        <DashKitGridStack
            config={nested}
            editMode
            onChange={onChange}
            onResizeStop={onResizeStop}
        />,
    );
    const host = view.container.querySelector('[data-dashkit-id="a"]') as HTMLElement & {
        gridstackNode: {
            x: number;
            h: number;
            grid: {triggerEvent(event: Event, target: HTMLElement): void};
        };
    };
    const plugin = view.container.querySelector('[data-identity]');
    const grid = host.gridstackNode.grid;
    await act(async () => {
        grid.triggerEvent(new Event('resizestart'), host);
        host.gridstackNode.h = 200;
        grid.triggerEvent(new Event('resizestop'), host);
        await Promise.resolve();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(onResizeStop).toHaveBeenCalledTimes(1);
    expect(host.gridstackNode.h).toBe(4);
    expect(view.container.querySelector('[data-identity]')).toBe(plugin);
    await act(async () => {
        grid.triggerEvent(new Event('resizestart'), host);
        host.gridstackNode.h = 5;
        grid.triggerEvent(new Event('resizestop'), host);
        await Promise.resolve();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].config.layout[0].h).toBe(5);
    expect(view.container.querySelector('[data-identity]')).toBe(plugin);
    view.unmount();
});

// Critical: yes. Child-grid columns must not shrink an unrelated saved root widget.
test.each([2, 20])(
    'nested width %s keeps root nowrap resizing in root units',
    async (childWidth) => {
        const groups: DashKitGroup[] = [
            {
                id: DEFAULT_GROUP,
                gridProperties: () => ({
                    cols: 12,
                    rowHeight: 20,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: 'horizontal-nowrap',
                }),
            },
        ];
        const nested: Config = {
            ...config,
            items: ['root', 'child'].map((id) => ({...config.items[0], id, data: {text: id}})),
            layout: [
                {i: 'root', x: 6, y: 0, w: 2, h: 2},
                {i: 'child', containerId: 'box', x: 0, y: 0, w: childWidth, h: 2},
            ],
            containers: [
                {
                    ...box,
                    x: 0,
                    y: 0,
                    w: 6,
                    h: 6,
                    padding: [0, 0, 0, 0],
                    gap: [0, 0],
                    grid: {cols: 24, rowHeight: 20, compactType: null},
                },
            ],
        };
        const before = JSON.stringify(nested);
        const onChange = jest.fn();
        const view = render(
            <DashKitGridStack config={nested} groups={groups} editMode onChange={onChange} />,
        );
        const host = requireValue(
            view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="root"]'),
            'root host',
        );
        const plugin = host.querySelector('[data-identity]');
        const grid = requireValue(host.gridstackNode?.grid, 'root grid') as GridStack & {
            triggerEvent(event: Event, target: HTMLElement): void;
        };
        for (const [requested, expected] of [
            [4, 4],
            [20, 6],
        ]) {
            await act(async () => {
                grid.triggerEvent(new Event('resizestart'), host);
                grid.engine.moveNodeCheck(requireValue(host.gridstackNode, 'root node'), {
                    x: 6,
                    y: 0,
                    w: requested,
                    h: 2,
                    resizing: true,
                });
                grid.triggerEvent(new Event('resizestop'), host);
                await Promise.resolve();
            });
            expect(host.gridstackNode).toMatchObject({x: 6, y: 0, w: expected, h: 2});
            expect(onChange.mock.calls.at(-1)[0].config.layout).toEqual([
                {...nested.layout[0], w: expected},
                nested.layout[1],
            ]);
            expect(onChange.mock.calls.at(-1)[0].config.containers).toEqual(nested.containers);
            expect(host.querySelector('[data-identity]')).toBe(plugin);
        }
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(JSON.stringify(nested)).toBe(before);
        view.unmount();
    },
);
