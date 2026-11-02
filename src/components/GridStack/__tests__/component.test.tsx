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

import {act, fireEvent, render} from '@testing-library/react';
import {flushSync} from 'react-dom';

import type {Config} from '../../../shared';
import type {DashKitGroup, PluginWidgetProps} from '../../../typings';
import * as legacyGrid from '../../../utils/grid-layout';
import {DashKitGridStack} from '../DashKitGridStack';
import {requireValue} from '../invariants';
import {GridStack} from '../runtime';
import type {GridItemHTMLElement} from '../runtime';
const type = 'gridstack-mounted-contract';
const config: Config = {
    salt: 'test',
    counter: 1,
    aliases: {},
    connections: [],
    items: [{id: 'a', type, namespace: 'default', data: {text: 'retained'}}],
    layout: [{i: 'a', x: 0, y: 0, w: 6, h: 4}],
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

// Critical: yes. Reloads must address current widgets in config order after removal and reorder.
test('desktop metadata and reload follow config order after removal, reorder and re-add', async () => {
    const reload = jest.fn();
    class Reloadable extends React.Component<PluginWidgetProps> {
        render = () => <span>{this.props.id}</span>;
        getMeta = () => Promise.resolve(this.props.id);
        reload = (options: unknown) => reload(this.props.id, options);
    }
    const reloadType = 'native-reload-order';
    DashKitGridStack.reloadPlugins({
        type: reloadType,
        defaultLayout: {w: 2, h: 2},
        renderer: (props, ref) => <Reloadable {...props} ref={ref} />,
    });
    const document: Config = {
        ...config,
        items: ['a', 'b', 'c'].map((id) => ({...config.items[0], id, type: reloadType})),
        layout: ['a', 'b', 'c'].map((i, index) => ({i, x: index * 3, y: 0, w: 2, h: 2})),
    };
    const ref = React.createRef<DashKitGridStack>();
    const fixture = (saved: Config) => <DashKitGridStack ref={ref} config={saved} editMode />;
    const view = render(fixture(document));
    const check = async (ids: string[]) => {
        const current = requireValue(ref.current, 'DashKit ref');
        expect(await Promise.all(current.getItemsMeta())).toEqual(ids);
        reload.mockClear();
        current.reloadItems({force: true});
        expect(reload.mock.calls.map(([id]) => id)).toEqual(ids);
    };
    await check(['a', 'b', 'c']);
    view.rerender(
        fixture({
            ...document,
            items: document.items.slice(1).reverse(),
            layout: document.layout.slice(1),
        }),
    );
    await check(['c', 'b']);
    reload.mockClear();
    requireValue(ref.current, 'DashKit ref').reloadItems({force: true, targetIds: ['a', 'c']});
    expect(reload.mock.calls.map(([id]) => id)).toEqual(['c']);
    view.rerender(fixture(document));
    await check(['a', 'b', 'c']);
});

test('StrictMode mount/unmount cleans native DD and retains one live metadata ref', async () => {
    const ref = React.createRef<DashKitGridStack>();
    const view = render(
        <React.StrictMode>
            <DashKitGridStack ref={ref} config={config} editMode />
        </React.StrictMode>,
    );
    const host = view.container.querySelector('[data-dashkit-id="a"]') as HTMLElement;
    const grid = view.container.querySelector('.grid-stack') as HTMLElement & {
        gridstack?: GridStack;
    };
    expect(view.container.querySelectorAll('[data-identity]')).toHaveLength(1);
    expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toHaveLength(
        1,
    );
    expect(GridStack.getDD().isDraggable(host)).toBe(true);
    view.rerender(
        <React.StrictMode>
            <DashKitGridStack
                ref={ref}
                config={{...config, layout: [{...config.layout[0], x: 2}]}}
                editMode
            />
        </React.StrictMode>,
    );
    expect(view.container.querySelector('[data-dashkit-id="a"]')).toBe(host);
    expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toHaveLength(
        1,
    );
    view.unmount();
    expect(ref.current).toBeNull();
    expect(grid.gridstack).toBeUndefined();
    expect(GridStack.getDD().isDraggable(host)).toBe(false);
});

// Critical: yes. Synchronous renderer commits must not destroy DD before native start returns.
test.each(['drag', 'resize'])(
    '%s start replacement survives a synchronous renderer commit and the next drag',
    async (gesture) => {
        const measure = jest
            .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
            .mockImplementation(function (this: HTMLElement) {
                const node = this.closest<GridItemHTMLElement>('[data-dashkit-id]')?.gridstackNode;
                return new DOMRect(
                    this.style.position === 'fixed'
                        ? parseFloat(this.style.left) || 0
                        : (node?.x || 0) * 50,
                    this.style.position === 'fixed'
                        ? parseFloat(this.style.top) || 0
                        : (node?.y || 0) * 20,
                    parseFloat(this.style.width) || (node?.w || 12) * 50,
                    parseFloat(this.style.height) || (node?.h || 20) * 20,
                );
            });
        const initial: Config = {...config, layout: [{i: 'a', x: 0, y: 0, w: 2, h: 2}]};
        const replacement: Config = {...initial, layout: [{...initial.layout[0], x: 3, y: 3}]};
        const callbacks: string[] = [];
        const onChange = jest.fn();
        const errors: unknown[] = [];
        const onError = (event: ErrorEvent) => {
            errors.push(event.error);
            event.preventDefault();
        };
        const groups: DashKitGroup[] = [
            {
                gridProperties: () => ({
                    cols: 12,
                    width: 600,
                    rowHeight: 20,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                    resizeHandles: ['se'],
                }),
            },
        ];
        function Fixture() {
            const [saved, setSaved] = React.useState(initial);
            const replaced = React.useRef(false);
            const start = () => {
                callbacks.push('start');
                if (!replaced.current) {
                    replaced.current = true;
                    flushSync(() => setSaved(replacement));
                }
            };
            const stop = () => callbacks.push('stop');
            return (
                <>
                    <DashKitGridStack
                        config={saved}
                        groups={groups}
                        editMode
                        onDragStart={start}
                        onResizeStart={start}
                        onDragStop={stop}
                        onResizeStop={stop}
                        onChange={({config: next}) => {
                            onChange(next);
                            setSaved(next);
                        }}
                    />
                    <pre data-testid="saved-config">{JSON.stringify(saved)}</pre>
                </>
            );
        }
        const view = render(<Fixture />);
        const host = requireValue(
            view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="a"]'),
            'native host',
        );
        const plugin = requireValue(host.querySelector('[data-identity]'), 'mounted plugin');
        const forceUpdate = React.PureComponent.prototype.forceUpdate;
        // Use real React commits with synchronous delivery, without replacing the mounted class.
        const synchronousCommit = jest
            .spyOn(React.PureComponent.prototype, 'forceUpdate')
            .mockImplementation(function (this: React.Component, callback) {
                flushSync(() => forceUpdate.call(this, callback));
            });
        window.addEventListener('error', onError);
        try {
            const target = requireValue(
                host.querySelector(
                    gesture === 'resize' ? '.ui-resizable-se' : '.grid-stack-item-content',
                ),
                'native gesture target',
            );
            fireEvent.mouseDown(target, {button: 0, clientX: 10, clientY: 10, buttons: 1});
            fireEvent.mouseMove(document, {clientX: 20, clientY: 20, buttons: 1});
            await act(async () => {
                await Promise.resolve();
            });
            fireEvent.mouseMove(document, {clientX: 90, clientY: 50, buttons: 1});
            fireEvent.mouseUp(document, {clientX: 90, clientY: 50});
            expect(errors).toEqual([]);
            expect(synchronousCommit).toHaveBeenCalled();
            expect(onChange).not.toHaveBeenCalled();
            expect(view.getByTestId('saved-config').textContent).toBe(JSON.stringify(replacement));
            expect(host.gridstackNode).toMatchObject({x: 3, y: 3, w: 2, h: 2});
            expect(host.gridstackNode?.grid?.el).toBe(host.parentElement);
            expect(host.querySelector('[data-identity]')).toBe(plugin);
            expect(callbacks).toEqual(['start', 'stop']);

            const content = requireValue(host.querySelector('.grid-stack-item-content'), 'content');
            fireEvent.mouseDown(content, {button: 0, clientX: 160, clientY: 70, buttons: 1});
            fireEvent.mouseMove(document, {clientX: 165, clientY: 75, buttons: 1});
            fireEvent.mouseMove(document, {clientX: 210, clientY: 90, buttons: 1});
            fireEvent.mouseUp(document, {clientX: 210, clientY: 90});
            await act(async () => {
                await Promise.resolve();
            });
            expect(errors).toEqual([]);
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange.mock.calls[0][0].layout).toEqual([
                {...replacement.layout[0], x: 4, y: 4},
            ]);
            expect(callbacks).toEqual(['start', 'stop', 'start', 'stop']);
            expect(host.querySelector('[data-identity]')).toBe(plugin);
        } finally {
            synchronousCommit.mockRestore();
            window.removeEventListener('error', onError);
            view.unmount();
            measure.mockRestore();
        }
    },
);

test('new-component item helpers never delegate layout to the legacy compactor', () => {
    const compact = jest.spyOn(legacyGrid, 'compact').mockImplementation(() => {
        throw new Error('legacy layout must not run');
    });
    try {
        const options = {
            updateLayout: config.layout,
            reflowLayoutOptions: {defaultProps: {cols: 12}},
        };
        expect(() =>
            DashKitGridStack.setItem({
                config,
                item: {type, data: {}, layout: {x: 0, y: 0, w: 4, h: 2}},
                options,
            }),
        ).not.toThrow();
        expect(compact).not.toHaveBeenCalled();
    } finally {
        compact.mockRestore();
    }
});

test('external same-grid item reorder changes native stacking without remounting portals', () => {
    const flat: Config = {
        ...config,
        items: [config.items[0], {...config.items[0], id: 'b'}],
        layout: [config.layout[0], {...config.layout[0], i: 'b'}],
    };
    const view = render(<DashKitGridStack config={flat} editMode />);
    const root = requireValue(view.container.querySelector('.grid-stack'), 'grid root');
    const hosts = [...root.querySelectorAll(':scope > [data-dashkit-id]')];
    const identities = hosts.map((host) => host.querySelector('[data-identity]'));
    view.rerender(
        <DashKitGridStack config={{...flat, items: [...flat.items].reverse()}} editMode />,
    );
    expect([...root.querySelectorAll(':scope > [data-dashkit-id]')]).toEqual(hosts.reverse());
    expect(hosts.map((host) => host.querySelector('[data-identity]'))).toEqual(
        identities.reverse(),
    );
    view.unmount();
});

test('StrictMode custom plugin handles bind after portal render and update without remount', async () => {
    const customType = 'native-custom-handle-regression';
    const bodyDown = jest.fn();
    const LateHandle = () => {
        const [visible, setVisible] = React.useState(false);
        return (
            <>
                <button onClick={() => setVisible(true)}>Reveal late handle</button>
                {visible && <span className="late-handle">Late Handle A</span>}
            </>
        );
    };
    DashKitGridStack.reloadPlugins({
        type: customType,
        defaultLayout: {w: 2, h: 2, minW: 1, minH: 1},
        renderer: (props, ref) => (
            <div>
                <Plugin {...props} ref={ref} />
                <LateHandle />
                {props.data.handleVisible && (
                    <span className="handle-a" key={String(props.data.handleVersion)}>
                        Handle A
                    </span>
                )}
                <button className="handle-b">
                    <span>Handle B</span>
                    <svg data-testid="handle-icon">
                        <path />
                    </svg>
                </button>
                <span className="chart-body" onMouseDown={bodyDown}>
                    Chart body
                </span>
            </div>
        ),
    });
    const measure = jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
            const node = this.closest<GridItemHTMLElement>('[data-dashkit-id]')?.gridstackNode;
            const x =
                this.style.position === 'fixed'
                    ? parseFloat(this.style.left) || 0
                    : (node?.x || 0) * 50;
            const y =
                this.style.position === 'fixed'
                    ? parseFloat(this.style.top) || 0
                    : (node?.y || 0) * 20;
            const width = this.style.width === '1px' ? 1 : (node?.w || 12) * 50;
            const height = this.style.height === '1px' ? 1 : (node?.h || 20) * 20;
            return {
                x,
                y,
                width,
                height,
                left: x,
                top: y,
                right: x + width,
                bottom: y + height,
                toJSON: () => ({}),
            };
        });
    const initial: Config = {
        ...config,
        items: [
            {
                ...config.items[0],
                type: customType,
                data: {text: 'Custom plugin', handleVisible: true, handleVersion: 1},
            },
        ],
        layout: [{i: 'a', x: 0, y: 0, w: 2, h: 2}],
    };
    const onChange = jest.fn();
    const onDragStart = jest.fn();
    const groups: DashKitGroup[] = [
        {
            gridProperties: () => ({
                cols: 12,
                rowHeight: 20,
                margin: [0, 0],
                containerPadding: [0, 0],
                compactType: null,
                resizeHandles: ['se'],
                resizeHandle: () => <span>Custom resize control</span>,
            }),
        },
    ];
    const ref = React.createRef<DashKitGridStack>();
    const fixture = (document: Config, handle?: string, editMode = true) => (
        <React.StrictMode>
            <DashKitGridStack
                ref={ref}
                config={document}
                groups={groups}
                editMode={editMode}
                draggableHandleClassName={handle}
                onChange={onChange}
                onDragStart={onDragStart}
            />
        </React.StrictMode>
    );
    const view = render(fixture(initial, 'late-handle'));
    const host = requireValue(
        view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="a"]'),
        'custom host',
    );
    const plugin = host.querySelector('[data-identity]');
    const meta = await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta());
    const flush = () =>
        act(async () => {
            await Promise.resolve();
        });
    const drag = async (target: Element) => {
        const x = (host.gridstackNode?.x || 0) * 50 + 10;
        fireEvent.mouseDown(target, {button: 0, clientX: x, clientY: 10, buttons: 1});
        fireEvent.mouseMove(document, {clientX: x + 5, clientY: 10, buttons: 1});
        fireEvent.mouseMove(document, {clientX: x + 50, clientY: 10, buttons: 1});
        fireEvent.mouseUp(document, {clientX: x + 50, clientY: 10});
        await flush();
    };
    try {
        await flush();
        const resizeControl = view.getByText('Custom resize control');
        const resizeTarget = resizeControl.parentElement;
        await drag(view.getByText('Chart body'));
        expect(bodyDown).toHaveBeenCalledTimes(1);
        expect(onDragStart).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
        expect(host.gridstackNode?.x).toBe(0);
        fireEvent.click(view.getByText('Reveal late handle'));
        await flush();
        await drag(view.getByText('Late Handle A'));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls.at(-1)[0].config.layout[0].x).toBe(1);
        view.rerender(fixture(initial, 'handle-b'));
        await flush();
        const count = onChange.mock.calls.length;
        await drag(view.getByText('Handle A'));
        expect(onChange).toHaveBeenCalledTimes(count);
        await drag(view.getByText('Handle B'));
        expect(onChange).toHaveBeenCalledTimes(count + 1);
        expect(onChange.mock.calls.at(-1)[0].config.layout[0].x).toBe(2);
        await drag(
            requireValue(view.getByTestId('handle-icon').querySelector('path'), 'handle icon path'),
        );
        expect(onChange).toHaveBeenCalledTimes(count + 2);
        expect(onChange.mock.calls.at(-1)[0].config.layout[0].x).toBe(3);
        expect(view.getByText('Custom resize control')).toBe(resizeControl);
        expect(resizeControl.parentElement).toBe(resizeTarget);
        view.rerender(fixture(initial, 'handle-a', false));
        await flush();
        const viewCount = onChange.mock.calls.length;
        await drag(view.getByText('Handle A'));
        expect(onChange).toHaveBeenCalledTimes(viewCount);
        view.rerender(fixture(initial, 'handle-b', false));
        await flush();
        view.rerender(fixture(initial, 'handle-b'));
        await flush();
        const restoredX = host.gridstackNode?.x || 0;
        await drag(view.getByText('Handle B'));
        expect(onChange).toHaveBeenCalledTimes(viewCount + 1);
        expect(onChange.mock.calls.at(-1)[0].config.layout[0].x).toBe(restoredX + 1);
        const hidden: Config = {
            ...initial,
            items: [
                {
                    ...initial.items[0],
                    data: {text: 'Custom plugin', handleVisible: false, handleVersion: 2},
                },
            ],
        };
        view.rerender(fixture(hidden, 'handle-a'));
        await flush();
        const noHandleCount = onChange.mock.calls.length;
        await drag(view.getByText('Chart body'));
        expect(onChange).toHaveBeenCalledTimes(noHandleCount);
        const revealed: Config = {
            ...initial,
            items: [
                {
                    ...initial.items[0],
                    data: {text: 'Custom plugin', handleVisible: true, handleVersion: 3},
                },
            ],
        };
        view.rerender(fixture(revealed, 'handle-a'));
        await flush();
        await drag(view.getByText('Handle A'));
        expect(onChange).toHaveBeenCalledTimes(noHandleCount + 1);
        view.rerender(fixture(initial));
        await flush();
        const defaultCount = onChange.mock.calls.length;
        await drag(view.getByText('Chart body'));
        expect(onChange).toHaveBeenCalledTimes(defaultCount + 1);
        const restoredResizeControl = view.getByText('Custom resize control');
        expect(host.contains(restoredResizeControl)).toBe(true);
        const resizeX = ((host.gridstackNode?.x || 0) + (host.gridstackNode?.w || 0)) * 50;
        const resizeCount = onChange.mock.calls.length;
        fireEvent.mouseDown(restoredResizeControl, {
            button: 0,
            clientX: resizeX,
            clientY: 40,
            buttons: 1,
        });
        fireEvent.mouseMove(document, {clientX: resizeX + 50, clientY: 40, buttons: 1});
        fireEvent.mouseUp(document, {clientX: resizeX + 50, clientY: 40});
        await flush();
        expect(onChange).toHaveBeenCalledTimes(resizeCount + 1);
        expect(onChange.mock.calls.at(-1)[0].config.layout[0].w).toBe(3);
        expect(host.querySelector('[data-identity]')).toBe(plugin);
        expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toEqual(
            meta,
        );
        view.unmount();
        expect(GridStack.getDD().isDraggable(host)).toBe(false);
    } finally {
        measure.mockRestore();
    }
});

// Critical: yes. Native reflow must not mutate saved input while resolving a collision.
test('static reflow retains input geometry and rejects unknown nested membership', () => {
    const layout = [
        {i: 'a', x: 0, y: 0, w: 8, h: 2},
        {i: 'b', x: 2, y: 0, w: 6, h: 2},
    ];
    const before = JSON.stringify(layout);
    DashKitGridStack.reflowLayout({
        layout,
        groups: [{gridProperties: () => ({cols: 12, compactType: 'vertical'})}],
    });
    expect(JSON.stringify(layout)).toBe(before);
    const options = {layout, containers: []};
    expect(DashKitGridStack.reflowLayout(options)).toEqual(DashKitGridStack.reflowLayout({layout}));
    const incoming = {i: 'nested', x: 0, y: 0, w: 1, h: 1, containerId: 'box'};
    expect(() => DashKitGridStack.reflowLayout({layout, newLayoutItem: incoming})).toThrow(
        'unknown container',
    );
});

// Critical: yes. Invalid saved identities or geometry cannot be admitted to the native engine.
test.each([
    {...config, items: [config.items[0], config.items[0]]},
    {...config, layout: [...config.layout, config.layout[0]]},
    {...config, layout: [{...config.layout[0], i: 'missing'}]},
    {...config, layout: [{...config.layout[0], w: NaN}]},
])('rejects malformed flat config without a partial static update: %j', (invalid) => {
    const before = JSON.stringify(invalid);
    expect(() => DashKitGridStack.setItem({config: invalid, item: {type, data: {}}})).toThrow(
        'DashKitGridStack',
    );
    expect(JSON.stringify(invalid)).toBe(before);
});

// Critical: no. Mobile metadata must follow current config order even when visual groups do not.
test.each(['geometry', 'orderId'] as const)(
    'mobile metadata follows config order after reorder and removal with %s sorting',
    async (sorting) => {
        DashKitGridStack.setSettings({isMobile: true});
        try {
            const document: Config = {
                ...config,
                items: ['a', 'b', 'c', 'd'].map((id, index) => ({
                    ...config.items[0],
                    id,
                    data: {text: id},
                    orderId: sorting === 'orderId' ? [1, 4, 3, 2][index] : undefined,
                })),
                layout: [
                    {i: 'a', x: 0, y: 2, w: 2, h: 2, parent: 'left'},
                    {i: 'b', x: 6, y: 0, w: 3, h: 4, parent: 'right'},
                    {i: 'c', x: 4, y: 0, w: 4, h: 3, parent: 'left'},
                    {i: 'd', x: 2, y: 3, w: 5, h: 1, parent: 'right'},
                ],
            };
            const groups = [{id: 'right'}, {id: 'left'}];
            const ref = React.createRef<DashKitGridStack>();
            const fixture = (saved: Config) => (
                <DashKitGridStack ref={ref} config={saved} groups={groups} editMode={false} />
            );
            const view = render(fixture(document));
            const plugins = new Map(document.items.map(({id}) => [id, view.getByText(id)]));
            const metadata = async () =>
                Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta());
            const expected = (ids: string[]) =>
                ids.map((id) => ({
                    identity: Number(plugins.get(id)?.getAttribute('data-identity')),
                }));
            expect(await metadata()).toEqual(expected(['a', 'b', 'c', 'd']));
            view.rerender(fixture({...document, items: [...document.items].reverse()}));
            expect(await metadata()).toEqual(expected(['d', 'c', 'b', 'a']));
            view.rerender(
                fixture({
                    ...document,
                    items: [...document.items].reverse().filter(({id}) => id !== 'c'),
                    layout: document.layout.filter(({i}) => i !== 'c'),
                }),
            );
            expect(await metadata()).toEqual(expected(['d', 'b', 'a']));
            for (const id of ['a', 'b', 'd']) {
                expect(view.getByText(id)).toBe(plugins.get(id));
            }
            view.unmount();
        } finally {
            DashKitGridStack.setSettings({isMobile: false});
        }
    },
);
