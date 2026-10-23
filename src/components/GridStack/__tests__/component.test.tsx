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

import {DashKitContext} from '../../../context';
import type {DashKitCtxShape} from '../../../context';
import {withContext} from '../../../hocs/withContext';
import type {Config, GridStackContainer} from '../../../shared';
import type {PluginWidgetProps} from '../../../typings';
import * as legacyGrid from '../../../utils/grid-layout';
import {ActionPanel} from '../../ActionPanel/ActionPanel';
import {DashKit, _emitSymbol} from '../../DashKit/DashKit';
import {registerManager} from '../../DashKit/registration';
import {DashKitDnDWrapper} from '../../DashKitDnDWrapper/DashKitDnDWrapper';
import {DashKitGridStack} from '../DashKitGridStack';
import {requireValue} from '../invariants';
import {gridStackLayoutAdapter} from '../layout-adapter';
import {GridStack} from '../runtime';

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
let context: DashKitCtxShape;
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
function Probe() {
    context = React.useContext(DashKitContext);
    return null;
}
const ContextProbe = withContext(Probe, gridStackLayoutAdapter);
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
test('controlled reparent preserves the portal target, widget instance and metadata ref', async () => {
    const ref = React.createRef<DashKitGridStack>();
    const {container, rerender, unmount} = render(
        <DashKitGridStack ref={ref} config={config} editMode />,
    );
    const before = requireValue(
        container.querySelector('[data-identity]'),
        'widget element',
    ).getAttribute('data-identity');
    const target = requireValue(
        container.querySelector('[data-identity]'),
        'widget element',
    ).parentElement;
    const nested = {...config, layout: [{...config.layout[0], containerId: 'box'}]};
    rerender(<DashKitGridStack ref={ref} config={nested} editMode />);
    expect(
        requireValue(container.querySelector('[data-identity]'), 'widget element').getAttribute(
            'data-identity',
        ),
    ).toBe(before);
    expect(
        requireValue(container.querySelector('[data-identity]'), 'widget element').parentElement,
    ).toBe(target);
    expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toEqual([
        {identity: Number(before)},
    ]);
    expect(container.querySelectorAll('[data-qa="dashkit-grid-item"]')).toHaveLength(1);
    unmount();
});

test('global-only layout and static promotion preserve document geometry and metadata', () => {
    const promoted = DashKitGridStack.setItem({
        config,
        item: config.items[0],
        options: {useGlobalItems: true},
    });
    expect(promoted.items).toEqual([]);
    expect(promoted.globalItems).toEqual(config.items);
    expect(promoted.layout).toEqual(config.layout);
    expect(promoted.containers).toEqual(config.containers);
    const onChange = jest.fn();
    const view = render(<DashKitGridStack config={promoted} editMode onChange={onChange} />);
    fireEvent.click(view.getByText('retained'));
    expect(onChange.mock.calls[0][0].itemsStateAndParams.a.state).toEqual({clicked: true});
    expect(onChange.mock.calls[0][0].config.globalItems).toEqual(config.items);
    const local = DashKitGridStack.setItem({
        config: promoted,
        item: requireValue(promoted.globalItems, 'promoted.globalItems')[0],
        options: {useGlobalItems: false},
    });
    expect(local.items).toEqual(config.items);
    expect(local.globalItems).toEqual([]);
    expect(local.layout).toEqual(config.layout);
    view.unmount();
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
                config={{...config, layout: [{...config.layout[0], containerId: 'box'}]}}
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

test('suppressed container and widget transactions advance the full baseline used by parameter edits', () => {
    const instance = new DashKit(DashKit.defaultProps as never);
    const onChange = jest.fn();
    const events: Array<{
        layout: Config['layout'];
        previousLayout: Config['layout'];
        containers?: GridStackContainer[];
    }> = [];
    instance.on('change', (event) => {
        events.push(event);
        event.preventDefault();
    });
    const props = {
        ...DashKit.defaultProps,
        config,
        editMode: true,
        registerManager,
        forwardedMetaRef: null,
        emitDashKitEvent: instance[_emitSymbol],
        onChange,
    };
    const {rerender} = render(<ContextProbe {...props} />);
    const moved = [{...config.layout[0], x: 2, containerId: 'box'}];
    const movedContainers = [{...box, x: 3}];
    act(() => context.layoutChange(moved, movedContainers));
    act(() => context.layoutChange([{...moved[0], y: 3}], movedContainers));
    expect(onChange).not.toHaveBeenCalled();
    expect(events[1].previousLayout).toEqual(moved);
    act(() => context.onItemStateAndParamsChange('a', {state: {clicked: true}}));
    expect(onChange.mock.calls[0][0].config).toMatchObject({
        layout: [{...moved[0], y: 3}],
        containers: movedContainers,
    });
    const count = events.length;
    rerender(
        <ContextProbe
            {...props}
            config={{...config, layout: [...config.layout], containers: [{...box}]}}
        />,
    );
    expect(context.layout[0]).toMatchObject(config.layout[0]);
    expect(context.containers).toEqual([box]);
    expect(events).toHaveLength(count);
});

// Critical: yes. Loading tall content must not replace a valid nested dashboard with an error.
test.each([
    {padding: [0, 0, 0, 0], gap: [2, 2], y: 0, maxRows: undefined},
    {padding: [3, 0, 4, 0], gap: [2, 3], y: 1.25, maxRows: undefined},
    {padding: [3, 0, 4, 0], gap: [2, 3], y: 1.25, maxRows: 4},
])(
    'nested autoheight bounds visual sizing, resets and retains saved height: %j',
    async ({padding, gap, y, maxRows}) => {
        let widget: PluginWidgetProps | undefined;
        const renderer = jest.fn((props: PluginWidgetProps) => {
            widget = props;
            return (
                <button onClick={() => props.onStateAndParamsChange({state: {clicked: true}})}>
                    Tall content
                </button>
            );
        });
        const autoType = 'nested-autoheight';
        DashKitGridStack.reloadPlugins({
            type: autoType,
            defaultLayout: {w: 2, h: 2, minH: 1},
            renderer,
        });
        const container: GridStackContainer = {
            ...box,
            h: 6,
            padding: padding as GridStackContainer['padding'],
            gap: gap as GridStackContainer['gap'],
            grid: {...box.grid, maxRows},
        };
        const nested: Config = {
            ...config,
            containers: [container],
            items: [{...config.items[0], type: autoType}],
            layout: [{i: 'a', x: 0, y, w: 2, h: 2, containerId: 'box'}],
        };
        const groups = [
            {
                gridProperties: () => ({
                    cols: 12,
                    rowHeight: 18,
                    margin: [2, 2] as [number, number],
                    containerPadding: [0, 0] as [number, number],
                    compactType: null,
                }),
            },
        ];
        const before = JSON.stringify(nested);
        const onChange = jest.fn();
        const fixture = (document = nested) => (
            <DashKitGridStack config={document} groups={groups} editMode onChange={onChange} />
        );
        const view = render(fixture());
        const plugin = view.getByText('Tall content');
        const host = requireValue(
            view.container.querySelector('[data-dashkit-id="a"]'),
            'widget host',
        ) as import('../runtime').GridItemHTMLElement;
        const current = () => requireValue(widget, 'mounted plugin props');
        const grow = () => {
            const props = current();
            const entry = requireValue(
                props.layout.find(({i}) => i === 'a'),
                'widget layout',
            );
            props.adjustWidgetLayout({
                widgetId: 'a',
                adjustedWidgetLayout: {...entry, h: 20, minH: 20, maxH: 20},
            });
        };
        const capacity = Math.min(
            maxRows ?? Infinity,
            (6 * 20 - 2 - padding[0] - padding[2] + gap[1]) / (18 + gap[1]),
        );
        const remaining = capacity - y;
        act(grow);
        expect(current().layout[0]).toMatchObject({h: remaining, minH: remaining, maxH: remaining});
        expect(requireValue(host.gridstackNode, 'native node').h).toBeCloseTo(remaining, 10);
        expect(onChange).not.toHaveBeenCalled();
        const renders = renderer.mock.calls.length;
        act(grow);
        expect(renderer).toHaveBeenCalledTimes(renders);
        expect(view.getByText('Tall content')).toBe(plugin);
        const shrunk = {...nested, containers: [{...container, h: 4}]};
        view.rerender(fixture(shrunk));
        const shrunkRemaining =
            Math.min(
                maxRows ?? Infinity,
                (4 * 20 - 2 - padding[0] - padding[2] + gap[1]) / (18 + gap[1]),
            ) - y;
        expect(current().layout[0]).toMatchObject({
            h: shrunkRemaining,
            minH: shrunkRemaining,
            maxH: shrunkRemaining,
        });
        expect(requireValue(host.gridstackNode, 'native node').h).toBeCloseTo(shrunkRemaining, 10);
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.click(plugin);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].config.layout).toEqual(nested.layout);
        act(() => current().adjustWidgetLayout({widgetId: 'a', needSetDefault: true}));
        expect(current().layout[0].h).toBe(2);
        expect(requireValue(host.gridstackNode, 'native node')).toMatchObject({h: 2, minH: 1});
        expect(requireValue(host.gridstackNode, 'native node').maxH).toBeUndefined();
        await act(async () => {
            const node = requireValue(host.gridstackNode, 'native node');
            const grid = requireValue(node.grid, 'native grid') as GridStack & {
                triggerEvent(event: Event, target: HTMLElement): void;
            };
            grid.triggerEvent(new Event('dragstart'), host);
            grid.engine.moveNodeCheck(node, {x: 1, y});
            grid.triggerEvent(new Event('dragstop'), host);
            await Promise.resolve();
        });
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(onChange.mock.calls[1][0].config.layout).toEqual([{...nested.layout[0], x: 1}]);
        expect(onChange.mock.calls[1][0].config.containers).toEqual(shrunk.containers);
        expect(view.getByText('Tall content')).toBe(plugin);
        expect(JSON.stringify(nested)).toBe(before);
        const {containerId: _containerId, ...rootLayout} = nested.layout[0];
        view.rerender(fixture({...shrunk, layout: [{...rootLayout, x: 0, y: 0}]}));
        expect(view.getByText('Tall content')).toBe(plugin);
        expect(view.container.querySelector('[data-dashkit-id="a"]')).toBe(host);
        expect(requireValue(host.gridstackNode, 'native node')).toMatchObject({h: 2, minH: 1});
        expect(requireValue(host.gridstackNode, 'native node').maxH).toBeUndefined();
        expect(onChange).toHaveBeenCalledTimes(2);
        view.rerender(fixture(shrunk));
        act(grow);
        const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            expect(() =>
                view.rerender(fixture({...shrunk, layout: [{...nested.layout[0], h: 20}]})),
            ).toThrow('exceeds its container content bounds');
        } finally {
            error.mockRestore();
        }
        view.unmount();
    },
);

test('statics retain container membership and reject nonempty or unknown removal', () => {
    expect(() =>
        DashKitGridStack.removeItem({config, id: 'box', itemsStateAndParams: {}}),
    ).not.toThrow();
    const nested = {...config, layout: [{...config.layout[0], containerId: 'box'}]};
    expect(() =>
        DashKitGridStack.removeItem({config: nested, id: 'box', itemsStateAndParams: {}}),
    ).toThrow('move or remove children');
    expect(() =>
        DashKitGridStack.removeItem({config, id: 'missing', itemsStateAndParams: {}}),
    ).toThrow('unknown item');
    const next = DashKitGridStack.setItem({
        config,
        item: {type, data: {}, layout: {x: 0, y: 0, w: 2, h: 2, containerId: 'box'}},
    });
    expect(next.layout.at(-1)?.containerId).toBe('box');
    expect(next.items[0]).toEqual(config.items[0]);
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

test('parameter event from actual mounted plugin carries current nested membership', () => {
    const onChange = jest.fn();
    const nested = {...config, layout: [{...config.layout[0], containerId: 'box'}]};
    const {getByText} = render(<DashKitGridStack config={nested} editMode onChange={onChange} />);
    fireEvent.click(getByText('retained'));
    expect(onChange.mock.calls[0][0].config.layout[0]).toMatchObject({containerId: 'box'});
    expect(onChange.mock.calls[0][0].itemsStateAndParams.a.state).toEqual({clicked: true});
});

test('nested mobile traversal renders each widget once in hierarchy order with refs and parameter identity', () => {
    DashKitGridStack.setSettings({isMobile: true});
    const nested: Config = {
        ...config,
        items: ['a', 'b', 'c'].map((id) => ({id, type, namespace: 'default', data: {text: id}})),
        containers: [
            {...box, x: 5, y: 2},
            {...box, id: 'inside', containerId: 'box', x: 0, y: 3, w: 6, h: 4},
        ],
        layout: [
            {i: 'a', x: 0, y: 0, w: 4, h: 2},
            {i: 'b', x: 0, y: 1, w: 4, h: 2, containerId: 'box'},
            {i: 'c', x: 0, y: 0, w: 4, h: 2, containerId: 'inside'},
        ],
    };
    const mounted = jest.fn();
    const onChange = jest.fn();
    const ref = React.createRef<DashKitGridStack>();
    try {
        const view = render(
            <DashKitGridStack
                ref={ref}
                config={nested}
                editMode={false}
                onChange={onChange}
                onItemMountChange={mounted}
            />,
        );
        expect(
            [...view.container.querySelectorAll('[data-identity]')].map((el) => el.textContent),
        ).toEqual(['a', 'b', 'c']);
        expect(requireValue(ref.current, 'DashKit ref').getItemsMeta()).toHaveLength(3);
        expect(mounted.mock.calls.filter(([, state]) => state.isMounted)).toHaveLength(3);
        fireEvent.click(view.getByText('b'));
        expect(onChange.mock.calls[0][0].itemsStateAndParams.b.state).toEqual({clicked: true});
        expect(onChange.mock.calls[0][0].config.layout[1].containerId).toBe('box');
        view.rerender(
            <DashKitGridStack
                ref={ref}
                config={{
                    ...nested,
                    items: nested.items.map((item, index) => ({...item, orderId: 3 - index})),
                }}
                editMode={false}
                onChange={onChange}
            />,
        );
        expect(
            [...view.container.querySelectorAll('[data-identity]')].map((el) => el.textContent),
        ).toEqual(['c', 'b', 'a']);
        expect(requireValue(ref.current, 'DashKit ref').getItemsMeta()).toHaveLength(3);
        view.unmount();
    } finally {
        DashKitGridStack.setSettings({isMobile: false});
    }
});

test('force reload targets the current plugin ref after controlled reparent', () => {
    const reload = jest.fn();
    class Reloadable extends React.Component<PluginWidgetProps> {
        render() {
            return <span>reloadable</span>;
        }
        reload = (data: unknown) => reload(this.props.id, data);
    }
    const reloadType = 'gridstack-reload-test';
    DashKitGridStack.reloadPlugins({
        type: reloadType,
        renderer: (props, ref) => <Reloadable {...props} ref={ref} />,
    });
    const reloadConfig: Config = {
        ...config,
        items: config.items.map((item) => ({...item, type: reloadType})),
    };
    const ref = React.createRef<DashKitGridStack>();
    const view = render(<DashKitGridStack ref={ref} config={reloadConfig} editMode />);
    requireValue(ref.current, 'DashKit ref').reloadItems({targetIds: ['missing'], force: true});
    expect(reload).not.toHaveBeenCalled();
    view.rerender(
        <DashKitGridStack
            ref={ref}
            config={{...reloadConfig, layout: [{...reloadConfig.layout[0], containerId: 'box'}]}}
            editMode
            settings={{autoupdateInterval: 0, silentLoading: true}}
        />,
    );
    requireValue(ref.current, 'DashKit ref').reloadItems({targetIds: ['a'], force: true});
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith('a', {silentLoading: true, noVeil: true});
    view.unmount();
});

test('partial gridProperties retain the legacy rendered defaults and numeric style values', () => {
    const view = render(
        <DashKitGridStack
            config={{...config, containers: undefined, layoutVersion: undefined}}
            groups={[{gridProperties: () => ({style: {height: 400, width: 600}})}]}
            editMode
        />,
    );
    const widget = view.container.querySelector('[data-qa="dashkit-grid-item"]') as HTMLElement;
    expect(widget.dataset.dashkitGridCols).toBe('12');
    expect(widget.dataset.dashkitGridRowHeight).toBe('150');
    expect(widget.dataset.dashkitGridMarginX).toBe('10');
    expect(widget.dataset.dashkitGridPaddingY).toBe('10');
    const zone = view.container.querySelector('.dashkit-gridstack__zone') as HTMLElement;
    expect(zone.style.height).toBe('400px');
    expect(zone.style.width).toBe('600px');
    view.unmount();
});

test('nested grids inherit zone interactions without treating maxRows as minimum height', () => {
    const groups = [
        {
            gridProperties: () => ({
                cols: 12,
                rowHeight: 18,
                maxRows: 20,
                isDraggable: false,
                isResizable: false,
                resizeHandles: ['nw', 'ne', 'sw', 'se'] as Array<'nw' | 'ne' | 'sw' | 'se'>,
            }),
        },
    ];
    const view = render(
        <DashKitGridStack
            config={{...config, layout: [{...config.layout[0], containerId: 'box'}]}}
            groups={groups}
            editMode
        />,
    );
    const host = requireValue(view.container.querySelector('[data-dashkit-id="a"]'), 'widget host');
    expect(host.classList.contains('ui-draggable-disabled')).toBe(true);
    expect(host.classList.contains('ui-resizable-disabled')).toBe(true);
    expect(host.querySelectorAll('.ui-resizable-handle')).toHaveLength(0);
    const root = view.container.querySelector('.grid-stack') as HTMLElement & {
        gridstack: {opts: {minRow: number}; _updateContainerHeight(): void};
    };
    root.gridstack._updateContainerHeight();
    expect(root.gridstack.opts.minRow || 0).toBe(0);
    expect(parseFloat(root.style.height)).toBe(270);
    view.rerender(
        <DashKitGridStack
            config={{...config, layout: [{...config.layout[0], containerId: 'box'}]}}
            groups={[
                {
                    gridProperties: () => ({
                        ...groups[0].gridProperties(),
                        isDraggable: true,
                        isResizable: true,
                    }),
                },
            ]}
            editMode
        />,
    );
    expect(host.querySelectorAll('.ui-resizable-handle')).toHaveLength(4);
    view.unmount();
});

test('explicit container compaction is independent from global legacy verticalCompact false', () => {
    const defaults = registerManager.gridLayout;
    DashKitGridStack.setSettings({gridLayout: {verticalCompact: false}});
    try {
        const nested = {
            ...config,
            containers: [{...box, grid: {...box.grid, compactType: 'horizontal' as const}}],
            layout: [{...config.layout[0], x: 6, containerId: 'box'}],
        };
        const view = render(<DashKitGridStack config={nested} editMode />);
        const grids = [...view.container.querySelectorAll('.grid-stack')] as Array<
            HTMLElement & {gridstack: {engine: {mode: {compactType: unknown}}}}
        >;
        expect(grids[0].gridstack.engine.mode.compactType).toBeNull();
        expect(grids[1].gridstack.engine.mode.compactType).toBe('horizontal');
        expect(
            DashKitGridStack.reflowLayout({layout: nested.layout, containers: nested.containers})[0]
                .x,
        ).toBe(0);
        view.unmount();
    } finally {
        DashKitGridStack.setSettings({
            gridLayout: {...defaults, verticalCompact: defaults.verticalCompact},
        });
    }
});

test('external same-grid item reorder changes native stacking without remounting portals', () => {
    const flat: Config = {
        ...config,
        containers: undefined,
        layoutVersion: undefined,
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

test('removed or remounted zone roots dispose native grids and reattach the same nested portal', async () => {
    const nested = {...config, layout: [{...config.layout[0], containerId: 'box'}]};
    const ref = React.createRef<DashKitGridStack>();
    const onChange = jest.fn();
    const view = render(
        <DashKitGridStack ref={ref} config={nested} editMode groups={[{}]} onChange={onChange} />,
    );
    const widget = view.container.querySelector('[data-identity]');
    const root = view.container.querySelector('.grid-stack') as HTMLElement & {gridstack?: unknown};
    const meta = await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta());
    view.rerender(
        <DashKitGridStack ref={ref} config={nested} editMode groups={[]} onChange={onChange} />,
    );
    expect(root.gridstack).toBeUndefined();
    expect(view.container.querySelector('[data-identity]')).toBeNull();
    view.rerender(
        <DashKitGridStack ref={ref} config={nested} editMode groups={[{}]} onChange={onChange} />,
    );
    expect(view.container.querySelector('[data-identity]')).toBe(widget);
    expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toEqual(
        meta,
    );
    view.rerender(
        <DashKitGridStack
            ref={ref}
            config={nested}
            editMode
            groups={[{render: (id, children) => <section key={id}>{children}</section>}]}
            onChange={onChange}
        />,
    );
    expect(view.container.querySelector('[data-identity]')).toBe(widget);
    expect(view.container.querySelectorAll('.grid-stack')).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
    view.unmount();
});

test('controlled pin to an empty or newly introduced zone keeps the widget and its ref', async () => {
    const flat = {...config, containers: undefined, layoutVersion: undefined};
    const ref = React.createRef<DashKitGridStack>();
    const onChange = jest.fn();
    const view = render(
        <DashKitGridStack ref={ref} config={flat} groups={[{}]} editMode onChange={onChange} />,
    );
    const widget = view.container.querySelector('[data-identity]');
    const meta = await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta());
    const pinned = {...flat, layout: [{...flat.layout[0], parent: 'fixed'}]};
    view.rerender(
        <DashKitGridStack
            ref={ref}
            config={pinned}
            groups={[{id: 'fixed'}, {}]}
            editMode
            onChange={onChange}
        />,
    );
    expect(view.container.querySelector('[data-identity]')).toBe(widget);
    expect(view.container.querySelectorAll('[data-qa="dashkit-grid-item"]')).toHaveLength(1);
    expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toEqual(
        meta,
    );
    view.rerender(
        <DashKitGridStack
            ref={ref}
            config={flat}
            groups={[{id: 'fixed'}, {}]}
            editMode
            onChange={onChange}
        />,
    );
    view.rerender(
        <DashKitGridStack
            ref={ref}
            config={pinned}
            groups={[{id: 'fixed'}, {}]}
            editMode
            onChange={onChange}
        />,
    );
    expect(view.container.querySelector('[data-identity]')).toBe(widget);
    expect(onChange).not.toHaveBeenCalled();
    view.unmount();
});

test('invalid controlled membership is rejected before a replacement document callback', () => {
    const onChange = jest.fn();
    const view = render(<DashKitGridStack config={config} editMode onChange={onChange} />);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
        view.rerender(
            <DashKitGridStack
                config={{...config, layout: [{...config.layout[0], containerId: ''}]}}
                editMode
                onChange={onChange}
            />,
        ),
    ).toThrow('invalid containerId');
    expect(onChange).not.toHaveBeenCalled();
    error.mockRestore();
});

test('reload interval respects hidden and edit states, force targets and unmount cleanup', () => {
    jest.useFakeTimers();
    const reload = jest.fn();
    class TimedPlugin extends React.Component<PluginWidgetProps> {
        render() {
            return <span>timed</span>;
        }
        reload = () => reload(this.props.id);
    }
    const timedType = 'gridstack-timed-plugin';
    DashKitGridStack.reloadPlugins({
        type: timedType,
        renderer: (props, ref) => <TimedPlugin {...props} ref={ref} />,
    });
    const timed = {...config, items: [{...config.items[0], type: timedType}]};
    const ref = React.createRef<DashKitGridStack>();
    const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const view = render(
        <DashKitGridStack
            ref={ref}
            config={timed}
            editMode
            settings={{autoupdateInterval: 1, silentLoading: true}}
        />,
    );
    act(() => jest.advanceTimersByTime(1100));
    expect(reload).not.toHaveBeenCalled();
    view.rerender(
        <DashKitGridStack
            ref={ref}
            config={timed}
            editMode={false}
            settings={{autoupdateInterval: 1, silentLoading: true}}
        />,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    hidden.mockReturnValue(true);
    act(() => jest.advanceTimersByTime(1100));
    expect(reload).toHaveBeenCalledTimes(1);
    requireValue(ref.current, 'DashKit ref').reloadItems({targetIds: ['a'], force: true});
    expect(reload).toHaveBeenCalledTimes(2);
    hidden.mockReturnValue(false);
    fireEvent(document, new Event('visibilitychange'));
    act(() => jest.advanceTimersByTime(1100));
    expect(reload).toHaveBeenCalledTimes(3);
    view.unmount();
    act(() => jest.advanceTimersByTime(5000));
    expect(reload).toHaveBeenCalledTimes(3);
    hidden.mockRestore();
    jest.useRealTimers();
});

test('copy uses current saved nested dimensions, prop transformer and storage error callback', () => {
    const copy = jest.fn();
    const transform = jest.fn((options) => ({...options, copyContext: {source: 'prop'}}));
    const deprecatedTransform = jest.fn();
    const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
    const view = render(
        <DashKitGridStack
            config={{...config, layout: [{...config.layout[0], w: 7, h: 5, containerId: 'box'}]}}
            editMode
            overlayMenuItems={[{id: 'copy', title: 'Copy fixture', qa: 'copy-fixture'}]}
            getPreparedCopyItemOptions={transform}
            onCopyFulfill={copy}
            context={{getPreparedCopyItemOptions: deprecatedTransform}}
        />,
    );
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    fireEvent.click(view.getByText('Copy fixture'));
    expect(copy.mock.calls[0][0]).toBeNull();
    expect(copy.mock.calls[0][1]).toMatchObject({
        targetId: 'a',
        layout: {w: 7, h: 5},
        copyContext: {source: 'prop'},
        data: config.items[0].data,
    });
    expect(deprecatedTransform).not.toHaveBeenCalled();
    storage.mockImplementation(() => {
        throw new Error('storage denied');
    });
    fireEvent.click(view.getByText('Copy fixture'));
    expect(copy.mock.calls[1][0]).toEqual(new Error('storage denied'));
    warning.mockRestore();
    storage.mockRestore();
    view.unmount();
});

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

// Critical: yes. A denied/no-op native resize must not append a bogus history transaction.
test('GridStack no-op layout normalizes optional default-zone keys on both baseline and next config', () => {
    const instance = new DashKit(DashKit.defaultProps as never);
    const event = jest.fn();
    instance.on('change', event);
    const onChange = jest.fn();
    const flat = {...config, containers: undefined, layoutVersion: undefined};
    const props = {
        ...DashKit.defaultProps,
        config: flat,
        editMode: true,
        registerManager,
        forwardedMetaRef: null,
        emitDashKitEvent: instance[_emitSymbol],
        onChange,
    };
    render(<ContextProbe {...props} />);
    act(() => context.layoutChange(context.layout.map(({parent: _parent, ...entry}) => entry)));
    expect(event).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
});

// Critical: yes. Explicit subtree deletion must dispose descendants before their parent grid.
test('controlled removal of an entire nested subtree cleans native grids and plugin refs atomically', async () => {
    const inner = {
        ...box,
        id: 'inner',
        containerId: 'box',
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        padding: [0, 0, 0, 0] as [number, number, number, number],
        grid: {...box.grid, cols: 6},
    };
    const nested = {
        ...config,
        containers: [box, inner],
        layout: [{...config.layout[0], w: 3, h: 2, containerId: 'inner'}],
    };
    const ref = React.createRef<DashKitGridStack>();
    const onChange = jest.fn();
    const view = render(
        <DashKitGridStack ref={ref} config={nested} editMode onChange={onChange} />,
    );
    expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toHaveLength(
        1,
    );
    view.rerender(
        <DashKitGridStack
            ref={ref}
            config={{...nested, items: [], layout: [], containers: []}}
            editMode
            onChange={onChange}
        />,
    );
    expect(view.container.querySelectorAll('[data-identity]')).toHaveLength(0);
    expect(view.container.querySelectorAll('.grid-stack')).toHaveLength(1);
    expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
});

test('a hidden sibling root does not bypass measured container validation in a visible zone', () => {
    const measured = jest
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockImplementation(function (this: HTMLElement) {
            return this.closest('[data-hidden-grid]') ? 0 : 640;
        });
    const invalid = {
        ...config,
        items: [],
        layout: [],
        containers: [
            {
                ...box,
                parent: 'visible',
                padding: [1000, 0, 1000, 0] as [number, number, number, number],
            },
        ],
    };
    const groups = ['visible', 'hidden'].map((id) => ({
        id,
        render: (key: string, children: React.ReactNode) => (
            <section key={key} data-hidden-grid={id === 'hidden' ? true : undefined}>
                {children}
            </section>
        ),
    }));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<DashKitGridStack config={invalid} groups={groups} editMode />)).toThrow(
        'usable width or height',
    );
    error.mockRestore();
    measured.mockRestore();
});

// Critical: yes. Physical nested bounds must prevent invalid native edits without truncating saved fractions.
test.each([undefined, 4, 100])(
    'nested runtime intersects physical height with maxRows %s',
    (maxRows) => {
        const container = {...box, grid: {...box.grid, maxRows}};
        const nested = {
            ...config,
            containers: [container],
            layout: [{...config.layout[0], containerId: 'box'}],
        };
        const onChange = jest.fn();
        const view = render(<DashKitGridStack config={nested} editMode onChange={onChange} />);
        const root = view.container.querySelector(
            '[data-dashkit-id="box"] .grid-stack',
        ) as HTMLElement & {
            gridstack: {
                engine: {maxRow: number; willItFit(node: {w: number; h: number}): boolean};
                opts: {maxRow: number};
            };
        };
        // The root has 18px rows/2px gap: container height198, content158, child step24/gap6.
        const limit = Math.min(maxRows ?? Infinity, (198 - 10 - 30 + 6) / 24);
        expect(root.gridstack.engine.maxRow).toBe(limit);
        expect(root.gridstack.opts.maxRow).toBe(limit);
        expect(root.gridstack.engine.willItFit({w: 1, h: limit + 1})).toBe(false);
        expect(root.gridstack.engine.willItFit({w: 1, h: 1})).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
        expect(container.grid.maxRows).toBe(maxRows);
        view.unmount();
    },
);

test('fractional nested geometry survives controlled parent resizing and restoration without echo', () => {
    const nested = {
        ...config,
        layout: [{...config.layout[0], x: 0.25, y: 1.25, w: 3.5, h: 5.5, containerId: 'box'}],
    };
    const onChange = jest.fn();
    const view = render(<DashKitGridStack config={nested} editMode onChange={onChange} />);
    const plugin = view.container.querySelector('[data-identity]');
    const host = view.container.querySelector('[data-dashkit-id="a"]') as HTMLElement & {
        gridstackNode: {
            x: number;
            y: number;
            w: number;
            h: number;
            grid: {engine: {maxRow: number}};
        };
    };
    const original = {
        x: host.gridstackNode.x,
        y: host.gridstackNode.y,
        w: host.gridstackNode.w,
        h: host.gridstackNode.h,
    };
    expect(original).toEqual({x: 0.25, y: 1.25, w: 3.5, h: 5.5});
    const initialLimit = host.gridstackNode.grid.engine.maxRow;
    view.rerender(
        <DashKitGridStack
            config={{...nested, containers: [{...box, h: 12}]}}
            editMode
            onChange={onChange}
        />,
    );
    expect(host.gridstackNode.grid.engine.maxRow).toBe(initialLimit + 40 / 24);
    view.rerender(<DashKitGridStack config={nested} editMode onChange={onChange} />);
    expect(host.gridstackNode).toMatchObject(original);
    expect(host.gridstackNode.grid.engine.maxRow).toBe(initialLimit);
    expect(view.container.querySelector('[data-identity]')).toBe(plugin);
    expect(onChange).not.toHaveBeenCalled();
    view.unmount();
});

// Critical: yes. A malformed native proposal must be restored before history sees it.
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
        const groups = [
            {
                gridProperties: () => ({
                    cols: 12,
                    rowHeight: 18,
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
