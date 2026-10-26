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

test('custom plugin handles bind after portal render and update without remount', async () => {
    const customType = 'native-custom-handle-regression';
    const bodyDown = jest.fn();
    DashKitGridStack.reloadPlugins({
        type: customType,
        defaultLayout: {w: 2, h: 2, minW: 1, minH: 1},
        renderer: (props, ref) => (
            <div>
                <Plugin {...props} ref={ref} />
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
        <DashKitGridStack
            ref={ref}
            config={document}
            groups={groups}
            editMode={editMode}
            draggableHandleClassName={handle}
            onChange={onChange}
            onDragStart={onDragStart}
        />
    );
    const view = render(fixture(initial, 'handle-a'));
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
        await drag(view.getByText('Handle A'));
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
