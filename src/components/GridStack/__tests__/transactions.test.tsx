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

import {act, fireEvent, render, within} from '@testing-library/react';

import {DEFAULT_GROUP} from '../../../constants';
import type {Config, GridStackContainer} from '../../../shared';
import type {DashKitGroup, PluginWidgetProps} from '../../../typings';
import {ActionPanel} from '../../ActionPanel/ActionPanel';
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

// Critical: yes. A metadata-driven root remount must keep saved widgets attached.
test('palette preview cancels and reattaches saved widgets after a group root remount', () => {
    const flat: Config = {...config, containers: undefined, layoutVersion: undefined};
    const groups: DashKitGroup[] = [
        {
            gridProperties: () => ({width: 640}),
            render: (_id, children, props) => (
                <section key={props.context.version}>{children}</section>
            ),
        },
    ];
    const onChange = jest.fn();
    const fixture = (version: number) => (
        <DashKitDnDWrapper>
            <div>
                <ActionPanel items={[{id: 'add', icon: '+', title: 'Add', dragProps: {type}}]} />
                <DashKitGridStack
                    config={flat}
                    context={{version}}
                    editMode
                    groups={groups}
                    onChange={onChange}
                />
            </div>
        </DashKitDnDWrapper>
    );
    const view = render(fixture(0));
    const oldRoot = view.container.querySelector('.grid-stack') as HTMLElement & {
        gridstack?: GridStack;
    };
    const widget = view.container.querySelector('[data-identity]');
    jest.spyOn(oldRoot, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 640,
        bottom: 400,
        width: 640,
        height: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    });
    fireEvent.dragStart(view.getByRole('button', {name: '+ Add'}), {
        dataTransfer: {setDragImage: jest.fn()},
    });
    const over = new Event('dragover', {bubbles: true, cancelable: true});
    Object.assign(over, {clientX: 0, clientY: 0});
    fireEvent(oldRoot, over);
    expect(view.container.querySelector('[data-dashkit-id="__dropping-elem__"]')).not.toBeNull();

    view.rerender(fixture(1));
    const newRoot = view.container.querySelector('.grid-stack') as HTMLElement & {
        gridstack?: GridStack;
    };
    expect(newRoot).not.toBe(oldRoot);
    expect(oldRoot.gridstack).toBeUndefined();
    expect(newRoot.gridstack).toBeDefined();
    expect(view.container.querySelector('[data-identity]')).toBe(widget);
    expect(view.container.querySelector('[data-dashkit-id="__dropping-elem__"]')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    view.unmount();
});

// Critical: yes. Canceling an add must not persist displaced neighbors on the next save.
test.each([
    'dragend',
    'leave',
    'veto',
    'fit',
    'drop-bounds',
    'drop-error',
    'controlled',
    'edit-off',
    'geometry',
    'width',
] as const)(
    'palette collision followed by %s restores neighbors before a later saved gesture',
    async (cancellation) => {
        const flat: Config = {
            ...config,
            containers: undefined,
            layoutVersion: undefined,
            items: [config.items[0], {...config.items[0], id: 'b'}],
            layout: [
                {i: 'a', x: 0, y: 0, w: 3, h: 2},
                {i: 'b', x: 8, y: 0, w: 3, h: 2},
            ],
        };
        const onChange = jest.fn();
        let allowed = true;
        let rowHeight = 18;
        const groups = [
            {
                gridProperties: () => ({
                    cols: 12,
                    rowHeight,
                    margin: [0, 0] as [number, number],
                    containerPadding: [0, 0] as [number, number],
                    compactType: null,
                }),
            },
        ];
        const fixture = (document = flat, editMode = true) => (
            <DashKitDnDWrapper onDropDragOver={() => allowed}>
                <div>
                    <ActionPanel
                        items={[
                            {
                                id: 'add',
                                icon: '+',
                                title: 'Add',
                                dragProps: {type, layout: {w: 3, h: 2}},
                            },
                        ]}
                    />
                    <DashKitGridStack
                        config={document}
                        editMode={editMode}
                        groups={groups}
                        onChange={onChange}
                        onDrop={() => {
                            if (cancellation === 'drop-error') {
                                throw new Error('drop rejected');
                            }
                        }}
                    />
                </div>
            </DashKitDnDWrapper>
        );
        const view = render(fixture());
        const root = view.container.querySelector('.grid-stack') as HTMLElement & {
            gridstack: {
                engine: GridStack['engine'];
                triggerEvent(event: Event, target: HTMLElement): void;
            };
        };
        const host = view.container.querySelector(
            '[data-dashkit-id="a"]',
        ) as import('../runtime').GridItemHTMLElement;
        const next = view.container.querySelector(
            '[data-dashkit-id="b"]',
        ) as import('../runtime').GridItemHTMLElement;
        const identity = host.querySelector('[data-identity]');
        jest.spyOn(root, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            top: 0,
            right: 640,
            bottom: 400,
            width: 640,
            height: 400,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });
        const over = (x = 0, y = 0) => {
            const event = new Event('dragover', {bubbles: true, cancelable: true});
            Object.assign(event, {clientX: x, clientY: y});
            fireEvent(root, event);
        };
        fireEvent.dragStart(view.getByRole('button', {name: '+ Add'}), {
            dataTransfer: {setDragImage: jest.fn()},
        });
        over();
        expect(requireValue(host.gridstackNode, 'host.gridstackNode').y).toBe(2);
        expect(onChange).not.toHaveBeenCalled();
        let expected = flat.layout[0];
        if (cancellation === 'dragend') {
            fireEvent.dragEnd(window);
        }
        if (cancellation === 'leave') {
            const event = new Event('dragleave', {bubbles: true});
            Object.assign(event, {clientX: -1, clientY: -1, relatedTarget: null});
            fireEvent(root, event);
        }
        if (cancellation === 'veto') {
            allowed = false;
            over();
        }
        if (cancellation === 'fit') {
            const fit = jest.spyOn(root.gridstack.engine, 'willItFit').mockReturnValue(false);
            over();
            fit.mockRestore();
        }
        if (cancellation === 'drop-error') {
            const errors: string[] = [];
            const reject = (event: ErrorEvent) => {
                errors.push(event.message);
                event.preventDefault();
            };
            window.addEventListener('error', reject);
            fireEvent.drop(root);
            window.removeEventListener('error', reject);
            expect(errors).toEqual(['drop rejected']);
        }
        if (cancellation === 'drop-bounds') {
            root.gridstack.engine.maxRow = 1;
            fireEvent.drop(root);
        }
        if (cancellation === 'controlled') {
            expected = {...expected, x: 1, y: 1};
            view.rerender(fixture({...flat, layout: [expected, flat.layout[1]]}));
            fireEvent.dragEnd(window);
        }
        if (cancellation === 'edit-off') {
            view.rerender(fixture(flat, false));
        }
        if (cancellation === 'geometry') {
            rowHeight = 20;
            view.rerender(fixture());
        }
        if (cancellation === 'width') {
            jest.spyOn(root.parentElement as HTMLElement, 'clientWidth', 'get').mockReturnValue(
                600,
            );
            view.rerender(fixture());
        }
        expect(host.gridstackNode).toMatchObject({
            id: expected.i,
            x: expected.x,
            y: expected.y,
            w: expected.w,
            h: expected.h,
        });
        expect(view.container.querySelectorAll('[data-dashkit-id]')).toHaveLength(2);
        expect(host.querySelector('[data-identity]')).toBe(identity);
        expect(onChange).not.toHaveBeenCalled();
        if (cancellation === 'edit-off') {
            view.rerender(fixture());
        }
        await act(async () => {
            root.gridstack.triggerEvent(new Event('dragstart'), next);
            root.gridstack.engine.moveNodeCheck(
                requireValue(next.gridstackNode, 'next.gridstackNode'),
                {x: 7, y: 0},
            );
            root.gridstack.triggerEvent(new Event('dragstop'), next);
            await Promise.resolve();
        });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].config.layout[0]).toMatchObject(expected);
        expect(onChange.mock.calls[0][0].config.layout[1]).toMatchObject({i: 'b', x: 7, y: 0});
        view.unmount();
    },
);

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

function paletteTransaction({
    bounded = false,
    scale = 1,
    gap = 0,
    height = 400,
    noOverlay = true,
} = {}) {
    const flat: Config = {
        ...config,
        containers: undefined,
        layoutVersion: undefined,
        items: [config.items[0], {...config.items[0], id: 'b'}],
        layout: [
            {i: 'a', x: 0, y: 0, w: 3, h: 2},
            {i: 'b', x: 8, y: 0, w: 3, h: 2},
        ],
    };
    const onChange = jest.fn();
    const onDrop = jest.fn();
    const onDragStart = jest.fn();
    const onResizeStart = jest.fn();
    const view = render(
        <DashKitDnDWrapper>
            <div>
                <ActionPanel
                    items={[
                        {
                            id: 'add',
                            icon: '+',
                            title: 'Add',
                            dragProps: {type, layout: {w: 3, h: 2}},
                        },
                    ]}
                />
                <DashKitGridStack
                    config={flat}
                    editMode
                    noOverlay={noOverlay}
                    groups={[
                        {
                            gridProperties: () => ({
                                cols: 12,
                                rowHeight: 40,
                                margin: [gap, gap],
                                containerPadding: [0, 0],
                                compactType: null,
                                maxRows: 100,
                                isBounded: bounded,
                            }),
                        },
                    ]}
                    onChange={onChange}
                    onDrop={onDrop}
                    onDragStart={onDragStart}
                    onResizeStart={onResizeStart}
                />
            </div>
        </DashKitDnDWrapper>,
    );
    const root = requireValue(
        view.container.querySelector<HTMLElement>('.grid-stack'),
        'root',
    ) as HTMLElement & {gridstack: GridStack & {triggerEvent(event: Event, el: HTMLElement): void}};
    jest.spyOn(root, 'clientHeight', 'get').mockReturnValue(height);
    jest.spyOn(root, 'getBoundingClientRect').mockReturnValue({
        left: 20,
        top: 30,
        right: 20 + 640 * scale,
        bottom: 30 + height * scale,
        width: 640 * scale,
        height: height * scale,
        x: 20,
        y: 30,
        toJSON: () => ({}),
    });
    const host = (id: string) =>
        requireValue(
            view.container.querySelector<GridItemHTMLElement>(`[data-dashkit-id="${id}"]`),
            'host',
        );
    const start = () =>
        fireEvent.dragStart(view.getByRole('button', {name: '+ Add'}), {
            dataTransfer: {setDragImage: jest.fn()},
        });
    const over = (x = 0, y = 0) => {
        const event = new Event('dragover', {bubbles: true, cancelable: true});
        Object.assign(event, {clientX: 20 + x * scale, clientY: 30 + y * scale});
        fireEvent(root, event);
    };
    const drop = () => fireEvent.drop(root);
    return {
        view,
        root,
        host,
        flat,
        start,
        over,
        drop,
        onDrop,
        onChange,
        onDragStart,
        onResizeStart,
    };
}

// Critical: yes. Saving an unrelated palette item must preserve original autoheight data.
test('palette newLayout keeps saved autoheight while pending nodes keep visual height and displacement', () => {
    const renderer = ({id, layout, adjustWidgetLayout}: PluginWidgetProps) => (
        <button
            onClick={() => {
                const entry = requireValue(
                    layout.find(({i}) => i === id),
                    'layout',
                );
                adjustWidgetLayout({
                    widgetId: id,
                    adjustedWidgetLayout: {...entry, h: 4, minH: 4, maxH: 4},
                });
            }}
        >
            Grow {id}
        </button>
    );
    DashKitGridStack.reloadPlugins({type, defaultLayout: {w: 3, h: 2}, renderer});
    const f = paletteTransaction();
    fireEvent.click(f.view.getByRole('button', {name: 'Grow a'}));
    expect(f.host('a').gridstackNode?.h).toBe(4);
    f.start();
    f.over();
    f.drop();
    expect(f.onDrop).toHaveBeenCalledTimes(1);
    expect(f.onDrop.mock.calls[0][0].newLayout).toEqual([
        {...f.flat.layout[0], y: 2},
        f.flat.layout[1],
    ]);
    expect(f.host('a').gridstackNode).toMatchObject({y: 2, h: 4});
    expect(f.onChange).not.toHaveBeenCalled();
    act(() => f.onDrop.mock.calls[0][0].commit());
    expect(f.host('a').gridstackNode).toMatchObject({y: 0, h: 4});
    f.view.unmount();
    DashKitGridStack.reloadPlugins({
        type,
        defaultLayout: {w: 6, h: 4},
        renderer: (props, ref) => <Plugin {...props} ref={ref} />,
    });
});

// Critical: yes. An unresolved add cannot leak collision displacement into native saves.
test.each(['drag', 'resize'])(
    'pending palette drop blocks native %s and next gesture works after cancel',
    async (gesture) => {
        const f = paletteTransaction();
        f.start();
        f.over();
        f.drop();
        expect(f.host('a').gridstackNode?.y).toBe(2);
        const next = f.host('b');
        const grid = f.root.gridstack;
        // Exercise the native event seam as well as the DD enablement boundary.
        await act(async () => {
            grid.triggerEvent(new Event(`${gesture}start`), next);
            grid.triggerEvent(new Event(`${gesture}stop`), next);
            await Promise.resolve();
        });
        expect(f.onChange).not.toHaveBeenCalled();
        expect(f.onDragStart).not.toHaveBeenCalled();
        expect(f.onResizeStart).not.toHaveBeenCalled();
        expect(grid.opts.disableDrag).toBe(true);
        expect(grid.opts.disableResize).toBe(true);
        act(() => f.onDrop.mock.calls[0][0].commit());
        expect(f.host('a').gridstackNode?.y).toBe(0);
        expect(grid.opts.disableDrag).toBeFalsy();
        expect(grid.opts.disableResize).toBeFalsy();
        await act(async () => {
            grid.triggerEvent(new Event(`${gesture}start`), next);
            grid.engine.moveNodeCheck(
                requireValue(next.gridstackNode, 'node'),
                gesture === 'drag' ? {x: 7} : {h: 3, resizing: true},
            );
            grid.triggerEvent(new Event(`${gesture}stop`), next);
            await Promise.resolve();
        });
        expect(f.onChange).toHaveBeenCalledTimes(1);
        expect(f.onChange.mock.calls[0][0].config.layout[0]).toEqual(f.flat.layout[0]);
        expect(f.onChange.mock.calls[0][0].config.layout[1]).toMatchObject(
            gesture === 'drag' ? {x: 7} : {h: 3},
        );
        f.view.unmount();
    },
);

// Critical: yes. A late async completion cannot cancel a newer user's pending addition.
test.each(['older-first', 'newer-first'])(
    'palette commits own their pending snapshot in %s order',
    (order) => {
        const f = paletteTransaction();
        f.start();
        f.over();
        f.drop();
        const commitA = f.onDrop.mock.calls[0][0].commit;
        f.over(); // Reentry cancels A; the following hover starts B.
        f.over(300, 120);
        f.drop();
        expect(f.onDrop).toHaveBeenCalledTimes(2);
        const commitB = f.onDrop.mock.calls[1][0].commit;
        expect(f.host('__dropping-elem__').gridstackNode).toMatchObject({y: 3});
        if (order === 'older-first') {
            act(commitA);
            expect(f.host('__dropping-elem__').gridstackNode).toMatchObject({y: 3});
        }
        act(commitB);
        act(commitA);
        expect(f.view.container.querySelector('[data-dashkit-id="__dropping-elem__"]')).toBeNull();
        expect(f.host('a').gridstackNode?.y).toBe(0);
        expect(f.onChange).not.toHaveBeenCalled();
        f.view.unmount();
    },
);

// Critical: yes. Engine maxRows cannot admit widgets beyond a bounded physical canvas.
test.each([1, 0.6, 2])(
    'bounded palette clamps scaled canvas at %s with gaps and rejects final overflow',
    (scale) => {
        const f = paletteTransaction({bounded: true, scale, gap: 8});
        f.start();
        f.over(630, 390);
        expect(f.host('__dropping-elem__').gridstackNode).toMatchObject({x: 9, y: 6, w: 3, h: 2});
        f.drop();
        expect(f.onDrop.mock.calls[0][0].itemLayout).toMatchObject({x: 9, y: 6});
        act(() => f.onDrop.mock.calls[0][0].commit());
        f.over(300, 120);
        const node = requireValue(f.host('__dropping-elem__').gridstackNode, 'node');
        node.y = 9; // Native collision/late movement can change the accepted proposal before drop.
        f.drop();
        expect(f.onDrop).toHaveBeenCalledTimes(1);
        expect(f.view.container.querySelector('[data-dashkit-id="__dropping-elem__"]')).toBeNull();
        expect(f.onChange).not.toHaveBeenCalled();
        f.view.unmount();
    },
);

test('bounded palette rejects an item taller than the physical canvas', () => {
    const f = paletteTransaction({bounded: true, height: 40});
    f.start();
    f.over();
    f.drop();
    expect(f.onDrop).not.toHaveBeenCalled();
    expect(f.view.container.querySelector('[data-dashkit-id="__dropping-elem__"]')).toBeNull();
    f.view.unmount();
});

// Critical: yes. Deleting a saved widget must not strand the active pending drop.
test('palette commit retains ownership after removing a saved widget from its snapshot', () => {
    const f = paletteTransaction({noOverlay: false});
    f.start();
    f.over();
    f.drop();
    fireEvent.click(within(f.host('b')).getByRole('button', {name: 'Delete'}));
    act(() => f.onDrop.mock.calls[0][0].commit());
    expect(f.view.container.querySelector('[data-dashkit-id="__dropping-elem__"]')).toBeNull();
    expect(f.root.gridstack.opts.disableDrag).toBeFalsy();
    f.view.unmount();
});
