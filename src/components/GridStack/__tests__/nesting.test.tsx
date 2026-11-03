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

import {DEFAULT_GROUP} from '../../../constants';
import {DashKitContext} from '../../../context';
import type {DashKitCtxShape} from '../../../context';
import {withContext} from '../../../hocs/withContext';
import type {Config, GridStackContainer} from '../../../shared';
import type {DashKitGroup, PluginWidgetProps} from '../../../typings';
import {DashKit, _emitSymbol} from '../../DashKit/DashKit';
import {registerManager} from '../../DashKit/registration';
import {DashKitGridStack} from '../DashKitGridStack';
import {validateConfig} from '../document';
import {getGridStackLayoutRects} from '../geometry';
import {requireValue} from '../invariants';
import {gridStackLayoutAdapter} from '../layout-adapter';
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
let measuredWidth = 640;
beforeAll(() => {
    DashKitGridStack.reloadPlugins({
        type,
        defaultLayout: {w: 6, h: 4},
        renderer: (props, ref) => <Plugin {...props} ref={ref} />,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get: () => measuredWidth,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get: () => 400,
    });
});

// Critical: yes. A transient narrow viewport must not unmount a valid saved dashboard.
test('measured narrow container defers projection and recovers without changing saved membership', () => {
    const narrow = {...config, containers: [{...box, w: 2}], layout: []};
    const groups: DashKitGroup[] = [{gridProperties: () => ({cols: 12, rowHeight: 18})}];
    measuredWidth = 1200;
    const view = render(<DashKitGridStack config={narrow} groups={groups} editMode />);
    try {
        measuredWidth = 100;
        expect(() =>
            view.rerender(<DashKitGridStack config={{...narrow}} groups={groups} editMode />),
        ).not.toThrow();
        measuredWidth = 1200;
        view.rerender(<DashKitGridStack config={{...narrow}} groups={groups} editMode />);
        expect(view.container.querySelector('[data-dashkit-id="box"]')).not.toBeNull();
    } finally {
        measuredWidth = 640;
        view.unmount();
    }
});

// Critical: yes. Plugin defaults must not write document membership during a parameter edit.
test.each([DashKit, DashKitGridStack])(
    'plugin default membership is ignored by %p',
    (Component) => {
        const defaultType = 'default-membership';
        DashKitGridStack.reloadPlugins({
            type: defaultType,
            defaultLayout: {w: 6, h: 4, containerId: 'missing'},
            renderer: (props, ref) => <Plugin {...props} ref={ref} />,
        });
        const onChange = jest.fn();
        const root = {
            ...config,
            items: [{...config.items[0], type: defaultType}],
            containers: undefined,
            layoutVersion: undefined,
        };
        const view = render(<Component config={root} onChange={onChange} editMode />);
        fireEvent.click(view.getByText('retained'));
        expect(onChange.mock.calls[0][0].config.layout[0].containerId).toBeUndefined();
        view.unmount();
    },
);

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

// Critical: yes. Valid controlled hierarchy swaps must not crash or remount widget state.
test.each([
    {order: 'inner-first', ids: ['inner', 'outer']},
    {order: 'outer-first', ids: ['outer', 'inner']},
])('controlled hierarchy swap preserves widget identity with $order descriptors', async ({ids}) => {
    const document = (rootId: string): Config => ({
        ...config,
        containers: ids.map((id) => ({
            ...box,
            id,
            w: id === rootId ? 12 : 6,
            h: id === rootId ? 10 : 6,
            padding: [0, 0, 0, 0],
            gap: [0, 0],
            ...(id === rootId ? {} : {containerId: rootId}),
        })),
        layout: [{...config.layout[0], w: 3, h: 2, containerId: 'outer'}],
    });
    const initial = document('outer');
    const swapped = document('inner');
    for (const candidate of [initial, swapped]) {
        expect(() => validateConfig(candidate)).not.toThrow();
        expect(() =>
            getGridStackLayoutRects(candidate, {
                [DEFAULT_GROUP]: {width: 640, gridProperties: {cols: 12, rowHeight: 18}},
            }),
        ).not.toThrow();
    }
    const ref = React.createRef<DashKitGridStack>();
    const onChange = jest.fn();
    const view = render(
        <DashKitGridStack ref={ref} config={initial} editMode onChange={onChange} />,
    );
    const widget = view.getByText('retained');
    const target = widget.parentElement;
    const meta = await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta());
    const outer = requireValue(
        view.container.querySelector('[data-dashkit-id="outer"]'),
        'outer host',
    );
    const inner = requireValue(
        view.container.querySelector('[data-dashkit-id="inner"]'),
        'inner host',
    );
    expect(outer.contains(inner)).toBe(true);
    for (const candidate of [swapped, initial]) {
        view.rerender(
            <DashKitGridStack ref={ref} config={candidate} editMode onChange={onChange} />,
        );
        expect(outer.contains(inner)).toBe(candidate === initial);
        expect(inner.contains(outer)).toBe(candidate === swapped);
        expect(outer.contains(widget)).toBe(true);
        expect(view.getByText('retained')).toBe(widget);
        expect(widget.parentElement).toBe(target);
        expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toEqual(
            meta,
        );
    }
    expect(onChange).not.toHaveBeenCalled();
    view.unmount();
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

// Critical: yes. Autoheight must preserve the last valid visual layout when siblings cannot fit.
test.each([
    {compactType: null, siblingHeight: 2, shrunkHeight: 5},
    {compactType: 'vertical' as const, siblingHeight: 2, shrunkHeight: 5},
    {compactType: null, siblingHeight: 1, shrunkHeight: 4},
    {compactType: 'vertical' as const, siblingHeight: 1, shrunkHeight: 4},
])(
    'nested autoheight rejects sibling overflow and retains valid reflow: %j',
    ({compactType, siblingHeight, shrunkHeight}) => {
        let widget: PluginWidgetProps | undefined;
        const autoType = 'nested-autoheight-siblings';
        DashKitGridStack.reloadPlugins({
            type: autoType,
            defaultLayout: {w: 2, h: 2, minH: 1},
            renderer: (props) => {
                if (props.id === 'a') {
                    widget = props;
                }
                return (
                    <button onClick={() => props.onStateAndParamsChange({state: {clicked: true}})}>
                        {props.id}
                    </button>
                );
            },
        });
        const nested: Config = {
            ...config,
            items: ['a', 'b'].map((id) => ({id, type: autoType, namespace: 'default', data: {}})),
            containers: [
                {
                    ...box,
                    h: 6,
                    padding: [0, 0, 0, 0],
                    gap: [0, 0],
                    grid: {...box.grid, compactType},
                },
            ],
            layout: [
                {i: 'a', x: 0, y: 0, w: 2, h: 2, containerId: 'box'},
                {i: 'b', x: 0, y: 3, w: 2, h: siblingHeight, containerId: 'box'},
            ],
        };
        const before = JSON.stringify(nested);
        const onChange = jest.fn();
        const groups: DashKitGroup[] = [
            {
                gridProperties: () => ({
                    cols: 12,
                    rowHeight: 18,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                }),
            },
        ];
        const fixture = (document = nested) => (
            <DashKitGridStack config={document} groups={groups} editMode onChange={onChange} />
        );
        const view = render(fixture());
        const visual = () =>
            ['a', 'b', 'box'].map((id) => {
                const host = requireValue(
                    view.container.querySelector(`[data-dashkit-id="${id}"]`),
                    'host',
                ) as GridItemHTMLElement;
                const {x, y, w, h} = requireValue(host.gridstackNode, 'native node');
                return {x, y, w, h};
            });
        const adjust = (h: number) => {
            const props = requireValue(widget, 'plugin props');
            props.adjustWidgetLayout({
                widgetId: 'a',
                adjustedWidgetLayout: {
                    ...requireValue(
                        props.layout.find(({i}) => i === 'a'),
                        'layout',
                    ),
                    h,
                    minH: h,
                    maxH: h,
                },
            });
        };
        const original = visual();
        act(() => adjust(20));
        expect(visual()).toEqual(original);
        const validHeight = 6 - siblingHeight;
        act(() => adjust(validHeight));
        const valid = [
            {...original[0], h: validHeight},
            {...original[1], y: validHeight},
            original[2],
        ];
        expect(visual()).toEqual(valid);
        act(() => adjust(20));
        expect(visual()).toEqual(valid);
        expect(requireValue(widget, 'plugin props').layout[0]).toMatchObject({
            h: validHeight,
            minH: validHeight,
            maxH: validHeight,
        });
        view.rerender(
            fixture({
                ...nested,
                containers: [
                    {...requireValue(nested.containers, 'containers')[0], h: shrunkHeight},
                ],
            }),
        );
        expect(visual()).toEqual([
            original[0],
            {...original[1], y: compactType === null ? 3 : 2},
            {...original[2], h: shrunkHeight},
        ]);
        view.rerender(fixture());
        act(() => adjust(validHeight));
        expect(visual()).toEqual(valid);
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.click(view.getByText('a'));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].config.layout).toEqual(nested.layout);
        expect(onChange.mock.calls[0][0].config.containers).toEqual(nested.containers);
        act(() =>
            requireValue(widget, 'plugin props').adjustWidgetLayout({
                widgetId: 'a',
                needSetDefault: true,
            }),
        );
        expect(visual()).toEqual([
            original[0],
            {...original[1], y: compactType === null ? 3 : 2},
            original[2],
        ]);
        expect(JSON.stringify(nested)).toBe(before);
        view.unmount();
    },
);

test('statics retain container membership and reject nonempty or unknown removal', () => {
    const itemsStateAndParams = {a: {state: {retained: true}, params: {key: 'value'}}};
    const before = JSON.stringify({config, itemsStateAndParams});
    const removed = DashKitGridStack.removeItem({config, id: 'box', itemsStateAndParams});
    expect(removed.config).toEqual({...config, containers: []});
    expect(removed.itemsStateAndParams).toEqual(itemsStateAndParams);
    expect(JSON.stringify({config, itemsStateAndParams})).toBe(before);
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

// Critical: yes. A stale gesture must not overwrite independent controlled document edits.
test.each([
    ['drag', 'layout'],
    ['resize', 'layout'],
    ['drag', 'containers'],
    ['resize', 'containers'],
] as const)(
    'controlled %s cancellation accepts a new %s revision without echo and retains the next gesture',
    async (gesture, revision) => {
        const initial: Config = {
            ...config,
            containers: [{...box, w: 2, h: 2, padding: [0, 0, 0, 0]}],
            items: [config.items[0], {...config.items[0], id: 'b'}],
            layout: [
                {i: 'a', x: 0, y: 0, w: 2, h: 2},
                {i: 'b', x: 6, y: 0, w: 2, h: 2},
            ],
        };
        const groups: DashKitGroup[] = [
            {
                gridProperties: () => ({
                    cols: 12,
                    rowHeight: 20,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                    allowOverlap: true,
                }),
            },
        ];
        const onChange = jest.fn();
        const events = jest.fn();
        const ref = React.createRef<DashKitGridStack>();
        const fixture = (document: Config) => (
            <DashKitGridStack
                ref={ref}
                config={document}
                groups={groups}
                editMode
                onChange={onChange}
            />
        );
        const view = render(fixture(initial));
        requireValue(ref.current, 'DashKit ref').on('change', events);
        const host = requireValue(
            view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="a"]'),
            'active host',
        );
        const plugin = host.querySelector('[data-identity]');
        const meta = await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta());
        const grid = requireValue(host.gridstackNode?.grid, 'active grid') as GridStack & {
            triggerEvent(event: Event, target: HTMLElement): void;
        };
        act(() => {
            grid.triggerEvent(new Event(`${gesture}start`), host);
            grid.engine.moveNodeCheck(requireValue(host.gridstackNode, 'active node'), {
                x: 1,
                w: gesture === 'resize' ? 3 : 2,
                resizing: gesture === 'resize',
            });
        });
        const external: Config = {
            ...initial,
            ...(revision === 'layout'
                ? {
                      layout: [
                          {...initial.layout[0], x: 4},
                          {...initial.layout[1], y: 5},
                      ],
                  }
                : {containers: [{...requireValue(initial.containers, 'containers')[0], x: 2}]}),
        };
        view.rerender(fixture(external));
        expect(host.gridstackNode).toMatchObject({x: external.layout[0].x, y: 0, w: 2, h: 2});
        expect(
            view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="box"]')
                ?.gridstackNode?.x,
        ).toBe(revision === 'containers' ? 2 : 0);
        await act(async () => {
            grid.triggerEvent(new Event(`${gesture}stop`), host);
            await Promise.resolve();
        });
        expect(host.gridstackNode).toMatchObject({x: external.layout[0].x, y: 0, w: 2, h: 2});
        expect(onChange).not.toHaveBeenCalled();
        expect(events).not.toHaveBeenCalled();
        expect(host.querySelector('[data-identity]')).toBe(plugin);
        expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toEqual(
            meta,
        );
        const next = requireValue(
            view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="b"]'),
            'next host',
        );
        await act(async () => {
            grid.triggerEvent(new Event('dragstart'), next);
            grid.engine.moveNodeCheck(requireValue(next.gridstackNode, 'next node'), {x: 7});
            grid.triggerEvent(new Event('dragstop'), next);
            await Promise.resolve();
        });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(events).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].config.layout).toEqual([
            external.layout[0],
            {...external.layout[1], x: 7},
        ]);
        expect(onChange.mock.calls[0][0].config.containers).toEqual(external.containers);
        view.unmount();
    },
);

// Critical: yes. Native pointer cleanup must not resave a stale document or break the next edit.
test.each(['drag', 'resize'] as const)(
    'controlled revision stops native %s pointer handlers before accepting the next gesture',
    async (gesture) => {
        const measure = jest
            .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
            .mockImplementation(function (this: HTMLElement) {
                const host = this.closest<GridItemHTMLElement>('[data-dashkit-id]');
                const node = host?.gridstackNode;
                const x =
                    this.style.position === 'fixed'
                        ? parseFloat(this.style.left) || 0
                        : (node?.x || 0) * (640 / 12);
                const y =
                    this.style.position === 'fixed'
                        ? parseFloat(this.style.top) || 0
                        : (node?.y || 0) * 20;
                const width = this.style.width === '1px' ? 1 : (node?.w || 12) * (640 / 12);
                const height = this.style.height === '1px' ? 1 : (node?.h || 20) * 20;
                return {
                    x,
                    y,
                    left: x,
                    top: y,
                    right: x + width,
                    bottom: y + height,
                    width,
                    height,
                    toJSON: () => ({}),
                };
            });
        const initial = {
            ...config,
            containers: undefined,
            layoutVersion: undefined,
            layout: [{i: 'a', x: 0, y: 0, w: 6, h: 4}],
        };
        const groups: DashKitGroup[] = [
            {
                gridProperties: () => ({
                    cols: 12,
                    rowHeight: 20,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                }),
            },
        ];
        const onChange = jest.fn();
        const onStart = jest.fn();
        const view = render(
            <DashKitGridStack
                config={initial}
                groups={groups}
                editMode
                onChange={onChange}
                onDragStart={onStart}
                onResizeStart={onStart}
            />,
        );
        const host = requireValue(
            view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="a"]'),
            'pointer host',
        );
        const plugin = host.querySelector('[data-identity]');
        const target = requireValue(
            host.querySelector<HTMLElement>(
                gesture === 'drag' ? '.grid-stack-item-content' : '.ui-resizable-se',
            ),
            'native pointer target',
        );
        fireEvent.mouseDown(target, {clientX: 100, clientY: 30, buttons: 1});
        fireEvent.mouseMove(document, {clientX: 110, clientY: 40, buttons: 1});
        fireEvent.mouseMove(document, {clientX: 165, clientY: 55, buttons: 1});
        expect(onStart).toHaveBeenCalledTimes(1);
        const external = {...initial, layout: [{...initial.layout[0], x: 2, y: 3}]};
        view.rerender(
            <DashKitGridStack
                config={external}
                groups={groups}
                editMode
                onChange={onChange}
                onDragStart={onStart}
                onResizeStart={onStart}
            />,
        );
        await act(async () => {
            await Promise.resolve();
        });
        fireEvent.mouseMove(document, {clientX: 300, clientY: 200, buttons: 1});
        fireEvent.mouseUp(document, {clientX: 300, clientY: 200});
        await act(async () => {
            await Promise.resolve();
        });
        expect(host.gridstackNode).toMatchObject({x: 2, y: 3, w: 6, h: 4});
        expect(onChange).not.toHaveBeenCalled();
        expect(host.querySelector('[data-identity]')).toBe(plugin);
        fireEvent.mouseDown(
            requireValue(
                host.querySelector<HTMLElement>('.grid-stack-item-content'),
                'next pointer target',
            ),
            {clientX: 150, clientY: 80, buttons: 1},
        );
        fireEvent.mouseMove(document, {clientX: 160, clientY: 80, buttons: 1});
        fireEvent.mouseMove(document, {clientX: 215, clientY: 80, buttons: 1});
        fireEvent.mouseUp(document, {clientX: 215, clientY: 80});
        await act(async () => {
            await Promise.resolve();
        });
        expect(onStart).toHaveBeenCalledTimes(2);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].config.layout).toEqual([{i: 'a', x: 3, y: 3, w: 6, h: 4}]);
        expect(host.querySelector('[data-identity]')).toBe(plugin);
        view.unmount();
        measure.mockRestore();
    },
);

// Critical: yes. Hidden destinations must not leak stale membership into the next saved edit.
test.each([false, true])(
    'controlled move to an absent zone parks the same widget/subtree (nested=%s)',
    async (nested) => {
        const initial: Config = {
            ...config,
            containers: nested
                ? [{...box, parent: 'left', w: 6, padding: [0, 0, 0, 0]}]
                : undefined,
            items: [config.items[0], {...config.items[0], id: 'b'}],
            layout: [
                {
                    i: 'a',
                    parent: 'left',
                    x: 0,
                    y: 0,
                    w: 2,
                    h: 2,
                    ...(nested ? {containerId: 'box'} : {}),
                },
                {i: 'b', parent: 'left', x: 8, y: 0, w: 2, h: 2},
            ],
        };
        const group: DashKitGroup = {
            id: 'left',
            gridProperties: () => ({
                cols: 12,
                rowHeight: 20,
                margin: [0, 0],
                containerPadding: [0, 0],
                compactType: null,
                allowOverlap: true,
            }),
        };
        const groups = [group];
        const onChange = jest.fn();
        const ref = React.createRef<DashKitGridStack>();
        const fixture = (document: Config, renderedGroups = groups) => (
            <DashKitGridStack
                ref={ref}
                config={document}
                groups={renderedGroups}
                editMode
                onChange={onChange}
            />
        );
        const view = render(fixture(initial));
        const host = requireValue(
            view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="a"]'),
            'widget host',
        );
        const plugin = host.querySelector('[data-identity]');
        const meta = await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta());
        const moved: Config = {
            ...initial,
            layout: [{...initial.layout[0], parent: 'inactive'}, initial.layout[1]],
            containers: initial.containers?.map((entry) => ({...entry, parent: 'inactive'})),
        };
        view.rerender(fixture(moved));
        expect(view.container.contains(host)).toBe(false);
        expect(host.querySelector('[data-identity]')).toBe(plugin);
        expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toEqual(
            meta,
        );
        expect(onChange).not.toHaveBeenCalled();
        const next = requireValue(
            view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="b"]'),
            'visible host',
        );
        const grid = requireValue(next.gridstackNode?.grid, 'visible grid') as GridStack & {
            triggerEvent(event: Event, target: HTMLElement): void;
        };
        await act(async () => {
            grid.triggerEvent(new Event('dragstart'), next);
            grid.engine.moveNodeCheck(requireValue(next.gridstackNode, 'visible node'), {x: 9});
            grid.triggerEvent(new Event('dragstop'), next);
            await Promise.resolve();
        });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].config.layout).toEqual([
            moved.layout[0],
            {...moved.layout[1], x: 9},
        ]);
        expect(onChange.mock.calls[0][0].config.containers).toEqual(moved.containers);
        view.rerender(
            fixture(onChange.mock.calls[0][0].config, [...groups, {...group, id: 'inactive'}]),
        );
        expect(view.container.querySelector('[data-dashkit-id="a"]')).toBe(host);
        expect(host.querySelector('[data-identity]')).toBe(plugin);
        expect(host.gridstackNode).toMatchObject({id: 'a', x: 0, y: 0, w: 2, h: 2});
        expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toEqual(
            meta,
        );
        expect(onChange).toHaveBeenCalledTimes(1);
        view.unmount();
    },
);

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

// Critical: yes. Controlled reparenting must remove stale flat constraints and restore them on return.
test('nowrap constraints stay correct across flat to nested to flat revisions', async () => {
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
    const flat: Config = {
        ...config,
        containers: undefined,
        layoutVersion: undefined,
        items: ['root', 'child'].map((id) => ({...config.items[0], id, data: {text: id}})),
        layout: [
            {i: 'root', x: 8, y: 0, w: 2, h: 2},
            {i: 'child', x: 0, y: 0, w: 8, h: 2},
        ],
    };
    const nested: Config = {
        ...flat,
        layoutVersion: 2,
        layout: [
            {...flat.layout[0], x: 6},
            {...flat.layout[1], containerId: 'box'},
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
    const onChange = jest.fn();
    const fixture = (document: Config) => (
        <DashKitGridStack config={document} groups={groups} editMode onChange={onChange} />
    );
    const view = render(fixture(flat));
    const host = requireValue(
        view.container.querySelector<GridItemHTMLElement>('[data-dashkit-id="root"]'),
        'root host',
    );
    const plugin = host.querySelector('[data-identity]');
    expect(host.gridstackNode?.maxW).toBe(4);
    view.rerender(fixture(nested));
    expect(onChange).not.toHaveBeenCalled();
    const resize = async (width: number) => {
        const grid = requireValue(host.gridstackNode?.grid, 'root grid') as GridStack & {
            triggerEvent(event: Event, target: HTMLElement): void;
        };
        await act(async () => {
            grid.triggerEvent(new Event('resizestart'), host);
            grid.engine.moveNodeCheck(requireValue(host.gridstackNode, 'root node'), {
                w: width,
                resizing: true,
            });
            grid.triggerEvent(new Event('resizestop'), host);
            await Promise.resolve();
        });
    };
    await resize(6);
    expect(host.gridstackNode).toMatchObject({x: 6, y: 0, w: 6, h: 2});
    expect(onChange.mock.calls.at(-1)[0].config.layout).toEqual([
        {...nested.layout[0], w: 6},
        nested.layout[1],
    ]);
    expect(onChange.mock.calls.at(-1)[0].config.containers).toEqual(nested.containers);
    view.rerender(fixture(flat));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(host.gridstackNode?.maxW).toBe(4);
    await resize(10);
    expect(host.gridstackNode).toMatchObject({x: 8, y: 0, w: 4, h: 2});
    expect(onChange.mock.calls.at(-1)[0].config.layout).toEqual([
        {...flat.layout[0], w: 4},
        flat.layout[1],
    ]);
    expect(onChange.mock.calls.at(-1)[0].config.containers).toBeUndefined();
    expect(host.querySelector('[data-identity]')).toBe(plugin);
    expect(onChange).toHaveBeenCalledTimes(2);
    view.unmount();
});

// Critical: yes. Root width leaking into children mis-sizes mounted widgets and their saved projections.
test('nested grids measure local content width through controlled resize with an explicit root width', async () => {
    const defaults = registerManager.gridLayout;
    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const widthType = 'nested-local-width';
    const widths = new Map<string, number>();
    DashKitGridStack.reloadPlugins({
        type: widthType,
        defaultLayout: {w: 6, h: 2},
        renderer: (props, ref) => {
            widths.set(props.id, props.width);
            return <Plugin {...props} ref={ref} />;
        },
    });
    const rootProperties = {
        cols: 640,
        rowHeight: 1,
        width: 640,
        margin: [0, 0] as [number, number],
        containerPadding: [0, 0] as [number, number],
        compactType: null,
        isDraggable: false,
        isResizable: false,
    };
    let outerWidth = 320;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get() {
            if (this.closest('[data-dashkit-id="inner"]')) {
                return (outerWidth - 40) / 2 - 20;
            }
            return this.closest('[data-dashkit-id="box"]') ? outerWidth - 40 : 500;
        },
    });
    const nested: Config = {
        ...config,
        items: ['root', 'child', 'deep'].map((id) => ({
            id,
            type: widthType,
            namespace: 'default',
            data: {text: id},
        })),
        layout: [
            {i: 'root', x: 400, y: 0, w: 100, h: 40},
            {i: 'child', x: 0, y: 0, w: 6, h: 2, containerId: 'box'},
            {i: 'deep', x: 0, y: 0, w: 6, h: 2, containerId: 'inner'},
        ],
        containers: [
            {
                ...box,
                w: outerWidth,
                h: 200,
                padding: [0, 20, 0, 20],
                gap: [0, 0],
                grid: {cols: 12, rowHeight: 20, compactType: null},
            },
            {
                ...box,
                id: 'inner',
                containerId: 'box',
                y: 3,
                w: 6,
                h: 4,
                padding: [0, 10, 0, 10],
                gap: [0, 0],
                grid: {cols: 12, rowHeight: 20, compactType: null},
            },
        ],
    };
    const before = JSON.stringify(nested);
    const ref = React.createRef<DashKitGridStack>();
    const onChange = jest.fn();
    let view: ReturnType<typeof render> | undefined;
    try {
        DashKitGridStack.setSettings({gridLayout: rootProperties});
        view = render(<DashKitGridStack ref={ref} config={nested} editMode onChange={onChange} />);
        const identities = [...view.container.querySelectorAll('[data-identity]')];
        const meta = await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta());
        const verify = (document: Config) => {
            const projection = getGridStackLayoutRects(document, {
                [DEFAULT_GROUP]: {width: 640, gridProperties: rootProperties},
            });
            for (const id of ['root', 'child', 'deep']) {
                expect(widths.get(id)).toBe(projection[id].width);
                const host = requireValue(
                    view?.container.querySelector(`[data-dashkit-id="${id}"]`),
                    'widget host',
                );
                expect(host.classList.contains('ui-draggable-disabled')).toBe(true);
                expect(host.classList.contains('ui-resizable-disabled')).toBe(true);
            }
            const grids = [
                ...requireValue(view, 'view').container.querySelectorAll<HTMLElement>(
                    '.grid-stack',
                ),
            ];
            expect(grids.map((grid) => grid.style.width)).toEqual([
                '640px',
                `${outerWidth - 40}px`,
                `${(outerWidth - 40) / 2 - 20}px`,
            ]);
        };
        verify(nested);
        outerWidth = 400;
        const resized = {
            ...nested,
            containers: requireValue(nested.containers, 'containers').map((entry) =>
                entry.id === 'box' ? {...entry, w: outerWidth} : entry,
            ),
        };
        view.rerender(<DashKitGridStack ref={ref} config={resized} editMode onChange={onChange} />);
        verify(resized);
        expect([...view.container.querySelectorAll('[data-identity]')]).toEqual(identities);
        expect(await Promise.all(requireValue(ref.current, 'DashKit ref').getItemsMeta())).toEqual(
            meta,
        );
        expect(onChange).not.toHaveBeenCalled();
        expect(JSON.stringify(nested)).toBe(before);
    } finally {
        view?.unmount();
        DashKitGridStack.setSettings({
            gridLayout: {
                ...defaults,
                width: defaults.width,
                compactType: defaults.compactType,
                isDraggable: defaults.isDraggable,
                isResizable: defaults.isResizable,
            },
        });
        if (clientWidth) {
            Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
        }
    }
});

test('empty nested drop zones fill their container with a fixed-height root style', () => {
    const defaults = registerManager.gridLayout;
    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get(this: HTMLElement) {
            return this.closest('[data-dashkit-id="box"]') ? 280 : 640;
        },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get(this: HTMLElement) {
            if (this.style.height.endsWith('px')) {
                return parseFloat(this.style.height);
            }
            const node =
                this.closest<GridItemHTMLElement>('[data-dashkit-id="box"]')?.gridstackNode;
            if (this.style.height === '100%' && node?.grid) {
                return (node.h || 0) * node.grid.getCellHeight(true);
            }
            return 0;
        },
    });
    const nested: Config = {
        ...config,
        items: [],
        layout: [],
        containers: [
            {
                ...box,
                w: 280,
                h: 200,
                padding: [0, 0, 0, 0],
                gap: [0, 0],
                grid: {cols: 12, rowHeight: 20, compactType: null},
            },
        ],
    };
    const before = JSON.stringify(nested);
    const onChange = jest.fn();
    let view: ReturnType<typeof render> | undefined;
    try {
        DashKitGridStack.setSettings({
            gridLayout: {
                cols: 640,
                rowHeight: 1,
                width: 640,
                margin: [0, 0],
                containerPadding: [0, 0],
                compactType: null,
                autoSize: false,
                style: {height: 400},
            },
        });
        view = render(<DashKitGridStack config={nested} editMode onChange={onChange} />);
        const root = requireValue(
            view.container.querySelector<HTMLElement>('.grid-stack'),
            'root grid',
        );
        const child = requireValue(
            view.container.querySelector<HTMLElement>('[data-dashkit-id="box"] .grid-stack'),
            'child grid',
        );
        const wrapper = requireValue(child.parentElement, 'child wrapper');
        expect(root.parentElement?.style.height).toBe('400px');
        expect(wrapper.style.height).toBe('100%');
        expect(wrapper.clientHeight).toBe(200);
        expect(child.style.height).toBe('200px');
        expect(child.style.width).toBe('280px');
        const resized: Config = {
            ...nested,
            containers: [{...requireValue(nested.containers, 'containers')[0], h: 240}],
        };
        view.rerender(<DashKitGridStack config={resized} editMode onChange={onChange} />);
        expect(view.container.querySelector('[data-dashkit-id="box"] .grid-stack')).toBe(child);
        expect(wrapper.style.height).toBe('100%');
        expect(wrapper.clientHeight).toBe(240);
        expect(child.style.height).toBe('240px');
        expect(root.parentElement?.style.height).toBe('400px');
        expect(onChange).not.toHaveBeenCalled();
        expect(JSON.stringify(nested)).toBe(before);
    } finally {
        view?.unmount();
        DashKitGridStack.setSettings({
            gridLayout: {
                ...defaults,
                width: defaults.width,
                compactType: defaults.compactType,
                autoSize: defaults.autoSize,
                style: defaults.style,
            },
        });
        if (clientWidth) {
            Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
        }
        if (clientHeight) {
            Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight);
        }
    }
});

// Critical: yes. A parked subtree must not prevent a visible dashboard from rendering.
test.each(['constructor', 'toString'])(
    'absent root %s does not block the visible root',
    (parent) => {
        const parked = {
            ...config,
            containers: [{...box, parent}],
        };
        const before = JSON.stringify(parked);
        const view = render(<DashKitGridStack config={parked} editMode />);
        expect(view.getByText('retained')).toBeTruthy();
        expect(JSON.stringify(parked)).toBe(before);
        view.unmount();
    },
);

// Critical: yes. Editing selectors must not create a document that cannot be rendered.
test('editing reserves container and caller-excluded IDs and validates the result', () => {
    const original: Config = {
        ...config,
        containers: [{...box, id: 'Ay'}],
    };
    const before = JSON.stringify(original);
    const item = {...original.items[0], data: {tabs: [{id: ''}]}};
    expect(() => validateConfig(original)).not.toThrow();
    const result = DashKitGridStack.setItem({config: original, item});
    const generated = requireValue(result.items[0].data.tabs, 'tabs')[0].id;
    const excluded = DashKitGridStack.setItem({
        config: original,
        item,
        options: {excludeIds: [generated]},
    });
    expect(requireValue(excluded.items[0].data.tabs, 'tabs')[0].id).not.toBe(generated);
    expect(generated).not.toBe('Ay');
    expect(() => validateConfig(result)).not.toThrow();
    expect(() =>
        DashKitGridStack.setItem({config: original, item: {...item, data: {tabs: [{id: 'Ay'}]}}}),
    ).toThrow('duplicate or reserved id "Ay"');
    expect(JSON.stringify(original)).toBe(before);
});
