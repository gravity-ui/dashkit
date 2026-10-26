/** @jest-environment jsdom */
jest.mock('@gravity-ui/icons', () => ({Ellipsis: 'ellipsis', Gear: 'gear', Xmark: 'xmark'}));
jest.mock('@gravity-ui/uikit', () => {
    const ReactMock = require('react');
    return {
        Button: ({
            children,
            onClick,
            title,
            qa,
        }: {
            children?: unknown;
            onClick?: () => void;
            title?: string;
            qa?: string;
        }) => ReactMock.createElement('button', {onClick, title, 'data-qa': qa}, children),
        DropdownMenu: ({items}: {items: Array<{text: string; action: () => void}>}) =>
            ReactMock.createElement(
                'div',
                null,
                items.map((item) =>
                    ReactMock.createElement(
                        'button',
                        {key: item.text, onClick: item.action},
                        item.text,
                    ),
                ),
            ),
        Icon: () => null,
    };
});

import assert from 'node:assert/strict';

import React from 'react';

import {act, fireEvent, render} from '@testing-library/react';

import {DashKitContext} from '../../../context';
import type {Config, ItemsStateAndParams} from '../../../shared';
import type {DashKitEventMap, DashKitGroup, PluginWidgetProps} from '../../../typings';
import {DashKit} from '../DashKit';

const type = 'flat-contract-widget';
const config: Config = {
    salt: 'flat-contract',
    counter: 1,
    aliases: {},
    connections: [],
    items: ['a', 'b'].map((id) => ({
        id,
        type,
        namespace: 'default',
        data: {text: id},
        defaults: {value: ['initial']},
    })),
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
        }),
    },
];
let identity = 0;
const reload = jest.fn();
class Widget extends React.Component<PluginWidgetProps> {
    static contextType = DashKitContext;
    declare context: React.ContextType<typeof DashKitContext>;
    identity = ++identity;
    render() {
        const entry = this.props.layout.find(({i}) => i === this.props.id);
        assert(entry);
        return (
            <div data-widget={this.props.id} data-identity={this.identity}>
                {this.props.data.text as string}
                <output data-params={this.props.id}>{JSON.stringify(this.props.params)}</output>
                <output data-state={this.props.id}>{JSON.stringify(this.props.state)}</output>
                {this.props.data.group?.map((selector) => (
                    <button
                        key={selector.id}
                        onClick={() =>
                            this.props.onStateAndParamsChange(
                                {
                                    params: {
                                        [selector.id === 'country' ? 'Country' : 'Year']: [
                                            'chosen',
                                        ],
                                    },
                                },
                                {groupItemIds: [selector.id]},
                            )
                        }
                    >
                        Apply {selector.id}
                    </button>
                ))}
                {this.props.data.tabs?.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => this.props.onStateAndParamsChange({state: {tabId: tab.id}})}
                    >
                        Tab {tab.id}
                    </button>
                ))}
                <button
                    onClick={() =>
                        this.props.onStateAndParamsChange({
                            state: {clicked: true},
                            params: {value: ['next']},
                        })
                    }
                >
                    Params {this.props.id}
                </button>
                <button
                    onClick={() =>
                        this.props.adjustWidgetLayout({
                            widgetId: this.props.id,
                            adjustedWidgetLayout: {...entry, h: 4},
                        })
                    }
                >
                    Grow {this.props.id}
                </button>
                <button
                    onClick={() =>
                        this.props.adjustWidgetLayout({
                            widgetId: this.props.id,
                            needSetDefault: true,
                        })
                    }
                >
                    Reset {this.props.id}
                </button>
            </div>
        );
    }
    getMeta = () => Promise.resolve({id: this.props.id, identity: this.identity});
    reload = (options: unknown) => reload(this.props.id, options);
}
const geometry = (container: HTMLElement, id: string) => {
    const plugin = container.querySelector<HTMLElement>(`[data-widget="${id}"]`);
    assert(plugin);
    const el = plugin.closest<HTMLElement>('[data-qa="dashkit-grid-item"]');
    assert(el);
    return Object.fromEntries(
        ['x', 'y', 'w', 'h'].map((key) => [
            key,
            Number(el.getAttribute(`data-dashkit-grid-${key}`)),
        ]),
    );
};
const jsonOutput = (container: HTMLElement, selector: string) => {
    const output = container.querySelector(selector);
    assert(output?.textContent, `Missing ${selector}`);
    return JSON.parse(output.textContent);
};
const rects = (layout: Config['layout']) => layout.map(({i, x, y, w, h}) => ({i, x, y, w, h}));

// Critical: yes. Saved edits, parameter identity and restore must survive either renderer.
// Only UI chrome is mocked; layout components, context, Item and plugin refs are real.
const LAYOUT_ENGINES = [['legacy', DashKit]] as const;
describe.each(LAYOUT_ENGINES)('[%s] common flat DashKit contract', (_engine, Component) => {
    beforeAll(() => {
        Component.reloadPlugins({
            type,
            defaultLayout: {w: 2, h: 2, minW: 1, minH: 1},
            renderer: (props, ref) => <Widget {...props} ref={ref} />,
        });
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
            configurable: true,
            get: () => 600,
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
            configurable: true,
            get() {
                return this.parentElement;
            },
        });
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
            configurable: true,
            get: () => 400,
        });
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement,
        ) {
            const entry = this.matches('[data-dashkit-id]')
                ? this.querySelector<HTMLElement>('[data-qa="dashkit-grid-item"]')
                : this.closest<HTMLElement>('[data-qa="dashkit-grid-item"]');
            const x =
                this.style.position === 'fixed'
                    ? parseFloat(this.style.left) || 0
                    : Number(entry?.dataset.dashkitGridX || 0) * 50;
            const y =
                this.style.position === 'fixed'
                    ? parseFloat(this.style.top) || 0
                    : Number(entry?.dataset.dashkitGridY || 0) * 20;
            const width = entry ? Number(entry.dataset.dashkitGridW) * 50 : 600;
            const height = entry ? Number(entry.dataset.dashkitGridH) * 20 : 400;
            return {
                x,
                y,
                width,
                height,
                top: y,
                left: x,
                right: x + width,
                bottom: y + height,
                toJSON: () => ({}),
            };
        });
    });
    afterAll(() => jest.restoreAllMocks());
    beforeEach(() => reload.mockClear());

    const drag = async (container: HTMLElement, id: string, dx: number) => {
        const plugin = container.querySelector<HTMLElement>(`[data-widget="${id}"]`);
        assert(plugin);
        const target = plugin.closest<HTMLElement>('[data-qa="dashkit-grid-item"]');
        assert(target);
        const x = Number(target.dataset.dashkitGridX) * 50 + 25;
        fireEvent.mouseDown(target, {clientX: x, clientY: 10, buttons: 1});
        fireEvent.mouseMove(document, {clientX: x + 5, clientY: 10, buttons: 1});
        fireEvent.mouseMove(document, {clientX: x + dx, clientY: 10, buttons: 1});
        fireEvent.mouseUp(document, {clientX: x + dx, clientY: 10});
        await act(async () => {
            await Promise.resolve();
        });
    };

    // Critical: yes. Wrong propagation after save/restore silently changes chart data.
    // Unlike helper tests, this checks delivered plugin output after UI actions on each renderer.
    test('multi-selector queue, aliases, ignores, namespaces and tabs survive gesture and controlled restore', async () => {
        const document: Config = {
            ...config,
            aliases: {default: [['Country', 'region']]},
            connections: [{from: 'ignored', to: 'country', kind: 'ignore'}],
            items: [
                {
                    id: 'a',
                    type,
                    namespace: 'default',
                    data: {
                        group: [
                            {
                                id: 'country',
                                namespace: 'default',
                                defaults: {Country: ['widget'], priority: ['widget-priority']},
                            },
                            {id: 'year', namespace: 'default', defaults: {Year: ['2025']}},
                        ],
                    },
                },
                {
                    id: 'b',
                    type,
                    namespace: 'default',
                    data: {
                        tabs: [
                            {id: 'first', isDefault: true, params: {tabOnly: ['first']}},
                            {id: 'second', params: {tabOnly: ['second']}},
                        ],
                    },
                },
                {
                    id: 'other',
                    type,
                    namespace: 'separate',
                    data: {},
                    defaults: {Country: ['isolated']},
                },
                {id: 'ignored', type, namespace: 'default', data: {}},
            ],
            layout: [
                ...config.layout,
                {i: 'other', x: 0, y: 4, w: 2, h: 2},
                {i: 'ignored', x: 6, y: 4, w: 2, h: 2},
            ],
        };
        const original = JSON.stringify(document);
        const defaults = {
            Country: ['global-default'],
            fallback: ['fallback'],
            priority: ['default'],
        };
        const globals = {priority: ['URL']};
        const settings = {autoupdateInterval: 0, silentLoading: true};
        const initialState: ItemsStateAndParams = {
            b: {state: {tabId: 'first'}, params: {_ap_old: ['stale']}},
            __meta__: {version: 2, queue: [{id: 'b', tabId: 'first'}]},
        };
        const changed = jest.fn();
        let currentDocument = document;
        let currentState = initialState;
        const view = render(<Component config={document} groups={groups} editMode />);
        const show = () =>
            view.rerender(
                <Component
                    config={currentDocument}
                    itemsStateAndParams={currentState}
                    defaultGlobalParams={defaults}
                    globalParams={globals}
                    settings={settings}
                    groups={groups}
                    editMode
                    onChange={(next) => {
                        changed(next);
                        currentDocument = next.config;
                        currentState = next.itemsStateAndParams;
                        show();
                    }}
                />,
            );
        show();
        const params = (id: string) => jsonOutput(view.container, `[data-params="${id}"]`);
        const state = () => jsonOutput(view.container, '[data-state="b"]');
        const base = {
            Country: ['widget'],
            region: ['widget'],
            Year: ['2025'],
            fallback: ['fallback'],
            priority: ['URL'],
        };
        expect(params('b')).toEqual({...base, tabOnly: ['first'], _ap_old: ['stale']});
        expect(params('ignored')).toEqual({
            Country: ['global-default'],
            region: ['global-default'],
            Year: ['2025'],
            fallback: ['fallback'],
            priority: ['URL'],
            old: ['stale'],
        });
        expect(params('other')).toEqual({
            Country: ['isolated'],
            fallback: ['fallback'],
            priority: ['URL'],
        });

        fireEvent.click(view.getByText('Apply country'));
        fireEvent.click(view.getByText('Apply year'));
        expect(currentState.__meta__).toEqual({
            version: 2,
            queue: [
                {id: 'b', tabId: 'first'},
                {id: 'a', groupItemId: 'country'},
                {id: 'a', groupItemId: 'year'},
            ],
        });
        expect(currentState).toMatchObject({
            a: {params: {country: {Country: ['chosen']}, year: {Year: ['chosen']}}},
        });
        expect(params('b')).toEqual({
            ...base,
            Country: ['chosen'],
            region: ['chosen'],
            Year: ['chosen'],
            tabOnly: ['first'],
            _ap_old: ['stale'],
        });
        expect(params('other')).toEqual({
            Country: ['isolated'],
            fallback: ['fallback'],
            priority: ['URL'],
        });
        expect(params('ignored').Country).toEqual(['global-default']);
        expect(params('ignored').Year).toEqual(['chosen']);

        fireEvent.click(view.getByText('Tab second'));
        expect(state()).toEqual({tabId: 'second'});
        expect(params('b')).toEqual({
            ...base,
            Country: ['chosen'],
            region: ['chosen'],
            Year: ['chosen'],
            tabOnly: ['second'],
        });
        expect(currentState.__meta__).toEqual({
            version: 2,
            queue: [
                {id: 'a', groupItemId: 'country'},
                {id: 'a', groupItemId: 'year'},
            ],
        });
        const beforeGesture = {config: currentDocument, itemsStateAndParams: currentState};
        const outputs = ['a', 'b', 'other', 'ignored'].map(params);
        changed.mockClear();
        await drag(view.container, 'b', 50);
        expect(changed).toHaveBeenCalledTimes(1);
        expect(currentDocument).toEqual({
            ...document,
            layout: [
                document.layout[0],
                {...document.layout[1], x: 7},
                ...document.layout.slice(2),
            ],
        });
        expect(currentState).toEqual(beforeGesture.itemsStateAndParams);
        expect(['a', 'b', 'other', 'ignored'].map(params)).toEqual(outputs);
        currentDocument = JSON.parse(JSON.stringify(beforeGesture.config));
        currentState = JSON.parse(JSON.stringify(beforeGesture.itemsStateAndParams));
        show();
        expect(geometry(view.container, 'b')).toEqual({x: 6, y: 0, w: 2, h: 2});
        expect(['a', 'b', 'other', 'ignored'].map(params)).toEqual(outputs);
        expect(state()).toEqual({tabId: 'second'});
        expect(changed).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(document)).toBe(original);
    });

    // Critical: no. Public customization must keep the correct actions and group content reachable.
    // Unique protection: exercises the production overlay handler/filter and group consumer on each renderer.
    test('group context and public overlay controls honor zone overrides and live params', () => {
        const document = {
            ...config,
            layout: config.layout.map((entry, index) => ({
                ...entry,
                parent: index ? 'right' : 'left',
            })),
        };
        const control = jest.fn();
        const menu = jest.fn();
        const renderGroup: DashKitGroup['render'] = (id, content, value) => (
            <section key={id} data-group={id}>
                <output data-group-context={id}>{JSON.stringify(value)}</output>
                {content}
            </section>
        );
        const zones: DashKitGroup[] = [
            {
                ...groups[0],
                id: 'left',
                render: renderGroup,
                gridProperties: () => ({
                    cols: 12,
                    rowHeight: 20,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                    noOverlay: false,
                }),
            },
            {...groups[0], id: 'right', render: renderGroup},
        ];
        const props = {
            config: document,
            groups: zones,
            editMode: true,
            noOverlay: true,
            context: {dashboard: 'first'},
            itemsStateAndParams: {a: {state: {clicked: true}, params: {value: ['live']}}},
            overlayControls: {[type]: [{title: 'Inspect', handler: control}]},
            overlayMenuItems: [
                {
                    id: 'inspect',
                    title: 'Inspect menu',
                    handler: menu,
                    visible: (item: Config['items'][number]) => item.id === 'a',
                },
            ],
        };
        const view = render(<Component {...props} />);
        const snapshot = (id: string) => jsonOutput(view.container, `[data-group-context="${id}"]`);
        expect(snapshot('left')).toEqual({
            isMobile: false,
            config: document,
            editMode: true,
            items: [document.items[0]],
            layout: [{...document.layout[0], minW: 1, minH: 1}],
            context: {dashboard: 'first'},
        });
        expect(snapshot('right')).toEqual({
            isMobile: false,
            config: document,
            editMode: true,
            items: [document.items[1]],
            layout: [{...document.layout[1], minW: 1, minH: 1}],
            context: {dashboard: 'first'},
        });
        expect(view.container.querySelectorAll('button[title="Inspect"]')).toHaveLength(1);
        const inspect = view.container.querySelector('button[title="Inspect"]');
        assert(inspect);
        fireEvent.click(inspect);
        fireEvent.click(view.getByText('Inspect menu'));
        expect(control).toHaveBeenCalledWith(document.items[0]);
        expect(menu).toHaveBeenCalledWith(document.items[0], {value: ['live']}, {clicked: true});
        view.rerender(<Component {...props} noOverlay={false} context={{dashboard: 'updated'}} />);
        expect(view.container.querySelectorAll('button[title="Inspect"]')).toHaveLength(2);
        expect(view.queryAllByText('Inspect menu')).toHaveLength(1);
        expect(snapshot('right').context).toEqual({dashboard: 'updated'});
        view.rerender(<Component {...props} noOverlay={false} editMode={false} />);
        expect(view.container.querySelectorAll('button[title="Inspect"]')).toHaveLength(0);
        expect(view.queryAllByText('Inspect menu')).toHaveLength(0);
        expect(snapshot('left').editMode).toBe(false);
    });

    test('mounted drag emits one public change and controlled restore applies without echo', async () => {
        const onChange = jest.fn();
        const events: DashKitEventMap['change'][] = [];
        const view = render(
            <Component
                config={config}
                groups={groups}
                editMode
                onChange={onChange}
                ref={(instance) => {
                    instance?.on('change', (event) => events.push(event));
                }}
            />,
        );
        const plugin = view.container.querySelector('[data-widget="a"]');
        await drag(view.container, 'a', 50);
        expect(events).toHaveLength(1);
        expect(rects(events[0].previousLayout)).toEqual(config.layout);
        expect(events[0].patches).toEqual([{i: 'a', x: 1, y: 0, w: 2, h: 2}]);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(rects(onChange.mock.calls[0][0].config.layout)).toEqual([
            {...config.layout[0], x: 1},
            config.layout[1],
        ]);
        expect(geometry(view.container, 'a')).toEqual({x: 1, y: 0, w: 2, h: 2});
        view.rerender(
            <Component
                config={{...config, layout: config.layout.map((entry) => ({...entry}))}}
                groups={groups}
                editMode
                onChange={onChange}
            />,
        );
        expect(geometry(view.container, 'a')).toEqual({x: 0, y: 0, w: 2, h: 2});
        expect(view.container.querySelector('[data-widget="a"]')).toBe(plugin);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    test('a mounted no-op gesture emits neither change nor onChange', async () => {
        const onChange = jest.fn();
        const event = jest.fn();
        const view = render(
            <Component
                config={config}
                groups={groups}
                editMode
                onChange={onChange}
                ref={(instance) => {
                    instance?.on('change', event);
                }}
            />,
        );
        await drag(view.container, 'a', 0);
        expect(event).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
        expect(geometry(view.container, 'a')).toEqual({x: 0, y: 0, w: 2, h: 2});
    });

    test('preventDefault advances the incremental baseline used by later gestures and params', async () => {
        const onChange = jest.fn();
        const events: DashKitEventMap['change'][] = [];
        const view = render(
            <Component
                config={config}
                groups={groups}
                editMode
                onChange={onChange}
                ref={(instance) => {
                    instance?.on('change', (event) => {
                        events.push(event);
                        event.preventDefault();
                    });
                }}
            />,
        );
        await drag(view.container, 'a', 50);
        await drag(view.container, 'b', 50);
        expect(events).toHaveLength(2);
        expect(events.every((event) => event.defaultPrevented)).toBe(true);
        expect(events[0].patches).toEqual([{i: 'a', x: 1, y: 0, w: 2, h: 2}]);
        expect(events[1].patches).toEqual([{i: 'b', x: 7, y: 0, w: 2, h: 2}]);
        expect(rects(events[1].previousLayout)).toEqual([
            {...config.layout[0], x: 1},
            config.layout[1],
        ]);
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.click(view.getByText('Params b'));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(rects(onChange.mock.calls[0][0].config.layout)).toEqual([
            {...config.layout[0], x: 1},
            {...config.layout[1], x: 7},
        ]);
        expect(onChange.mock.calls[0][0].itemsStateAndParams).toMatchObject({
            b: {state: {clicked: true}, params: {value: ['next']}},
        });
    });

    test('unsubscribe and throwing subscribers preserve later handlers and normal onChange', async () => {
        const removed = jest.fn();
        const received = jest.fn();
        const onChange = jest.fn();
        const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const view = render(
            <Component
                config={config}
                groups={groups}
                editMode
                onChange={onChange}
                ref={(instance) => {
                    if (instance) {
                        instance.on('change', removed)();
                        instance.on('change', () => {
                            throw new Error('subscriber failure');
                        });
                        instance.on('change', received);
                    }
                }}
            />,
        );
        await drag(view.container, 'a', 50);
        expect(removed).not.toHaveBeenCalled();
        expect(received).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalled();
        error.mockRestore();
    });

    test('external add, data update, reorder and removal retain widget identity and live refs', async () => {
        let instance: DashKit | null = null;
        const current = () => {
            assert(instance);
            return instance;
        };
        const ref = (value: typeof instance) => {
            instance = value;
        };
        const onChange = jest.fn();
        const mounted = jest.fn();
        const ready = jest.fn();
        const view = render(
            <Component
                ref={ref}
                config={config}
                groups={groups}
                editMode
                onChange={onChange}
                onItemMountChange={mounted}
                onItemRender={ready}
            />,
        );
        const original = view.container.querySelector('[data-widget="a"]');
        const originalMeta = await Promise.all(current().getItemsMeta());
        const reordered = {
            ...config,
            items: [...config.items].reverse(),
            layout: [...config.layout].reverse(),
        };
        view.rerender(
            <Component ref={ref} config={reordered} groups={groups} editMode onChange={onChange} />,
        );
        expect(await Promise.all(current().getItemsMeta())).toEqual(
            expect.arrayContaining(originalMeta),
        );
        expect(current().getItemsMeta()).toHaveLength(2);
        expect(view.container.querySelector('[data-widget="a"]')).toBe(original);
        const added = {
            ...config,
            items: [...config.items, {...config.items[0], id: 'c', data: {text: 'added'}}],
            layout: [...config.layout, {...config.layout[0], i: 'c', y: 4}],
        };
        view.rerender(
            <Component ref={ref} config={added} groups={groups} editMode onChange={onChange} />,
        );
        const addedPlugin = view.getByText('added');
        const addedMeta = (await Promise.all(current().getItemsMeta())).find(
            (entry) => entry.id === 'c',
        );
        expect(current().getItemsMeta()).toHaveLength(3);
        expect(view.container.querySelector('[data-widget="a"]')).toBe(original);
        const retained = {
            ...added,
            items: [{...added.items[2], data: {text: 'updated'}}],
            layout: [{...added.layout[2], x: 3}],
        };
        view.rerender(
            <Component
                ref={ref}
                config={retained}
                groups={groups}
                editMode={false}
                onChange={onChange}
            />,
        );
        expect(view.getByText('updated')).toBe(addedPlugin);
        expect(geometry(view.container, 'c')).toEqual({x: 3, y: 4, w: 2, h: 2});
        expect(await Promise.all(current().getItemsMeta())).toEqual([addedMeta]);
        current().reloadItems({targetIds: ['missing'], force: true});
        expect(reload).not.toHaveBeenCalled();
        current().reloadItems({targetIds: ['c'], force: true});
        expect(reload).toHaveBeenCalledWith('c', {silentLoading: false, noVeil: true});
        expect(mounted.mock.calls.filter(([, state]) => state.isMounted)).toHaveLength(2);
        expect(ready).toHaveBeenCalledTimes(2);
        expect(onChange).not.toHaveBeenCalled();
        view.unmount();
        expect(instance).toBeNull();
    });

    // Critical: no. Public mobile groups must retain widget geometry and identity after item reorder.
    test.each(['geometry', 'orderId'] as const)(
        'mobile item reorder preserves groups, layout and plugin identity with %s sorting',
        (sorting) => {
            Component.setSettings({isMobile: true});
            try {
                const mobileConfig: Config = {
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
                const renderGroup: DashKitGroup['render'] = (id, children, props) => (
                    <section key={id} data-group={id} data-items={JSON.stringify(props.items)}>
                        {children}
                    </section>
                );
                const mobileGroups = ['right', 'left'].map((id) => ({id, render: renderGroup}));
                const onChange = jest.fn();
                const mounted = jest.fn();
                const ready = jest.fn();
                const props = {
                    groups: mobileGroups,
                    editMode: false,
                    onChange,
                    onItemMountChange: mounted,
                    onItemRender: ready,
                };
                const view = render(<Component {...props} config={mobileConfig} />);
                const originalPlugins = Array.from(
                    view.container.querySelectorAll('[data-widget]'),
                );
                const expectedGroups =
                    sorting === 'geometry'
                        ? [
                              [
                                  {id: 'b', ...mobileConfig.layout[1]},
                                  {id: 'd', ...mobileConfig.layout[3]},
                              ],
                              [
                                  {id: 'c', ...mobileConfig.layout[2]},
                                  {id: 'a', ...mobileConfig.layout[0]},
                              ],
                          ]
                        : [
                              [
                                  {id: 'd', ...mobileConfig.layout[3]},
                                  {id: 'b', ...mobileConfig.layout[1]},
                              ],
                              [
                                  {id: 'a', ...mobileConfig.layout[0]},
                                  {id: 'c', ...mobileConfig.layout[2]},
                              ],
                          ];
                const renderedGroups = () =>
                    Array.from(view.container.querySelectorAll<HTMLElement>('[data-group]'));
                const renderedItems = () =>
                    renderedGroups().map((group) => {
                        assert(group.dataset.items);
                        return JSON.parse(group.dataset.items);
                    });
                expect(renderedGroups().map((group) => group.dataset.group)).toEqual([
                    'right',
                    'left',
                ]);
                expect(renderedItems()).toMatchObject(expectedGroups);
                expect(originalPlugins).toHaveLength(4);
                expect(mounted).toHaveBeenCalledTimes(4);
                expect(ready).toHaveBeenCalledTimes(4);

                // Keep the layout array and its entries unchanged; only reorder config.items.
                view.rerender(
                    <Component
                        {...props}
                        config={{...mobileConfig, items: [...mobileConfig.items].reverse()}}
                    />,
                );

                expect(renderedGroups().map((group) => group.dataset.group)).toEqual([
                    'right',
                    'left',
                ]);
                expect(renderedItems()).toMatchObject(expectedGroups);
                expect(Array.from(view.container.querySelectorAll('[data-widget]'))).toEqual(
                    originalPlugins,
                );
                for (const plugin of originalPlugins) {
                    expect(
                        view.container.querySelector(
                            `[data-widget="${plugin.getAttribute('data-widget')}"]`,
                        ),
                    ).toBe(plugin);
                }
                expect(mounted).toHaveBeenCalledTimes(4);
                expect(ready).toHaveBeenCalledTimes(4);
                expect(onChange).not.toHaveBeenCalled();
                view.unmount();
            } finally {
                Component.setSettings({isMobile: false});
            }
        },
    );

    test('controlled unrendered group membership survives another widget save and later reveal', async () => {
        const renderGroup: DashKitGroup['render'] = (id, content) => (
            <section key={id} data-group={id}>
                {content}
            </section>
        );
        const left = {...groups[0], id: 'left', render: renderGroup};
        const inactive = {...groups[0], id: 'inactive', render: renderGroup};
        const initial = {
            ...config,
            layout: config.layout.map((entry) => ({...entry, parent: 'left'})),
        };
        const hidden = {
            ...initial,
            layout: initial.layout.map((entry) =>
                entry.i === 'a' ? {...entry, parent: 'inactive'} : entry,
            ),
        };
        const before = JSON.stringify({initial, hidden});
        const onChange = jest.fn();
        const view = render(
            <Component config={initial} groups={[left]} editMode onChange={onChange} />,
        );
        expect(view.container.querySelectorAll('[data-widget]')).toHaveLength(2);
        view.rerender(<Component config={hidden} groups={[left]} editMode onChange={onChange} />);
        expect(view.container.querySelector('[data-widget="a"]')).toBeNull();
        expect(view.container.querySelectorAll('[data-widget]')).toHaveLength(1);
        expect(
            view.container.querySelector('[data-group="left"] [data-widget="b"]'),
        ).not.toBeNull();
        expect(onChange).not.toHaveBeenCalled();

        await drag(view.container, 'b', 50);
        expect(onChange).toHaveBeenCalledTimes(1);
        const saved: Config = onChange.mock.calls[0][0].config;
        expect(saved.layout).toEqual([hidden.layout[0], {...hidden.layout[1], x: 7}]);
        expect(view.container.querySelector('[data-widget="a"]')).toBeNull();
        expect(JSON.stringify({initial, hidden})).toBe(before);

        view.rerender(
            <Component config={saved} groups={[left, inactive]} editMode onChange={onChange} />,
        );
        expect(view.container.querySelectorAll('[data-widget]')).toHaveLength(2);
        expect(
            view.container.querySelector('[data-group="inactive"] [data-widget="a"]'),
        ).not.toBeNull();
        expect(
            view.container.querySelector('[data-group="left"] [data-widget="b"]'),
        ).not.toBeNull();
        expect(geometry(view.container, 'a')).toEqual({x: 0, y: 0, w: 2, h: 2});
        expect(geometry(view.container, 'b')).toEqual({x: 7, y: 0, w: 2, h: 2});
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(JSON.stringify({initial, hidden})).toBe(before);
    });

    test('view to edit transition retains widget identity and one metadata ref per item without echo', async () => {
        let instance: DashKit | null = null;
        const current = () => {
            assert(instance);
            return instance;
        };
        const ref = (value: typeof instance) => {
            instance = value;
        };
        const onChange = jest.fn();
        const view = render(
            <Component
                ref={ref}
                config={config}
                groups={groups}
                editMode={false}
                onChange={onChange}
            />,
        );
        const plugin = view.container.querySelector('[data-widget="a"]');
        const meta = await Promise.all(current().getItemsMeta());
        view.rerender(
            <Component ref={ref} config={config} groups={groups} editMode onChange={onChange} />,
        );
        expect(view.container.querySelector('[data-widget="a"]')).toBe(plugin);
        expect(view.container.querySelectorAll('[data-qa="dashkit-grid-item"]')).toHaveLength(2);
        expect(await Promise.all(current().getItemsMeta())).toEqual(meta);
        expect(onChange).not.toHaveBeenCalled();
    });

    test('visual autoheight survives a saved move and reset keeps the saved height', async () => {
        const onChange = jest.fn();
        const view = render(
            <Component config={config} groups={groups} editMode onChange={onChange} />,
        );
        fireEvent.click(view.getByText('Grow a'));
        expect(geometry(view.container, 'a').h).toBe(4);
        expect(onChange).not.toHaveBeenCalled();
        await drag(view.container, 'a', 50);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].config.layout[0]).toMatchObject({x: 1, h: 2});
        expect(geometry(view.container, 'a').h).toBe(4);
        fireEvent.click(view.getByText('Reset a'));
        expect(geometry(view.container, 'a').h).toBe(2);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    // Critical: yes. Mounting is not readiness; stale/unmounted async completions must not release loading.
    test('offscreen async content reports readiness only for the latest live load', () => {
        const completions: Array<() => void> = [];
        class AsyncWidget extends React.Component<PluginWidgetProps> {
            private generation = 0;

            componentDidMount() {
                completions.push(this.startLoad());
            }
            componentDidUpdate(previous: PluginWidgetProps) {
                if (previous.data !== this.props.data) {
                    completions.push(this.startLoad());
                }
            }
            componentWillUnmount() {
                this.generation++;
            }
            render() {
                return <span>{this.props.data.text as string}</span>;
            }
            startLoad() {
                const generation = ++this.generation;
                const complete = this.props.onBeforeLoad();
                return () => {
                    if (generation === this.generation) {
                        complete();
                    }
                };
            }
        }
        const asyncType = 'flat-contract-async';
        Component.reloadPlugins({
            type: asyncType,
            renderer: (props, ref) => <AsyncWidget {...props} ref={ref} />,
        });
        const offscreen = {
            ...config,
            items: [{...config.items[0], type: asyncType}],
            layout: [{...config.layout[0], y: 4000}],
        };
        const mounted = jest.fn();
        const ready = jest.fn();
        const view = render(
            <Component
                config={offscreen}
                groups={groups}
                editMode={false}
                onItemMountChange={mounted}
                onItemRender={ready}
            />,
        );
        expect(mounted).toHaveBeenCalledWith(offscreen.items[0], {
            isAsync: true,
            isMounted: true,
        });
        expect(ready).not.toHaveBeenCalled();
        const latest = {...offscreen.items[0], data: {text: 'latest'}};
        view.rerender(
            <Component
                config={{...offscreen, items: [latest]}}
                groups={groups}
                editMode={false}
                onItemMountChange={mounted}
                onItemRender={ready}
            />,
        );
        act(() => completions[0]());
        expect(ready).not.toHaveBeenCalled();
        act(() => completions[1]());
        expect(ready).toHaveBeenCalledTimes(1);
        expect(ready).toHaveBeenCalledWith(latest);
        view.unmount();
        act(() => completions[1]());
        expect(ready).toHaveBeenCalledTimes(1);
        expect(mounted.mock.calls.at(-1)[1].isMounted).toBe(false);
    });

    // Critical: yes. Same-id type edits must release loading without accepting old async completion.
    test('same-id async to synchronous type edit reports readiness once', () => {
        let completeOld!: () => void;
        function AsyncWidget(props: PluginWidgetProps) {
            const completion = React.useRef<(() => void) | undefined>(undefined);
            if (!completion.current) {
                completion.current = props.onBeforeLoad();
                completeOld = completion.current;
            }
            return <span>Pending</span>;
        }
        Component.reloadPlugins({
            type: 'type-replacement-async',
            renderer: (props) => <AsyncWidget {...props} />,
        });
        Component.reloadPlugins({
            type: 'type-replacement-sync',
            renderer: () => <span>Ready replacement</span>,
        });
        const original = {
            ...config,
            items: [{...config.items[0], type: 'type-replacement-async'}],
            layout: [config.layout[0]],
        };
        const mounted = jest.fn();
        const ready = jest.fn();
        const view = render(
            <Component
                config={original}
                groups={groups}
                editMode={false}
                onItemMountChange={mounted}
                onItemRender={ready}
            />,
        );
        expect(ready).not.toHaveBeenCalled();
        const replacement = Component.setItem({
            config: original,
            item: {...original.items[0], type: 'type-replacement-sync'},
            groups,
        });
        view.rerender(
            <Component
                config={replacement}
                groups={groups}
                editMode={false}
                onItemMountChange={mounted}
                onItemRender={ready}
            />,
        );
        expect(view.getByText('Ready replacement')).toBeTruthy();
        expect(ready).toHaveBeenCalledTimes(1);
        expect(ready).toHaveBeenCalledWith(replacement.items[0]);
        act(() => completeOld());
        expect(ready).toHaveBeenCalledTimes(1);
        expect(mounted).toHaveBeenCalledWith(original.items[0], {
            isAsync: true,
            isMounted: false,
        });
        expect(mounted).toHaveBeenCalledWith(replacement.items[0], {
            isAsync: false,
            isMounted: true,
        });
    });

    test('flat statics add, edit, promote and remove without mutating the caller document', () => {
        const before = JSON.stringify(config);
        const added = Component.setItem({
            config,
            item: {type, data: {text: 'added'}, layout: {x: 3, y: 4, w: 2, h: 2}},
            groups,
        });
        const item = added.items[2];
        expect(added.items).toHaveLength(3);
        expect(added.layout[2]).toMatchObject({i: item.id, x: 3, y: 4, w: 2, h: 2});
        const promoted = Component.setItem({
            config: added,
            item: {...item, data: {text: 'updated'}},
            options: {useGlobalItems: true},
            groups,
        });
        expect(promoted.globalItems).toEqual([{...item, data: {text: 'updated'}}]);
        expect(promoted.items).toEqual(config.items);
        expect(promoted.layout).toEqual(added.layout);
        const removed = Component.removeItem({
            config: promoted,
            id: item.id,
            itemsStateAndParams: {[item.id]: {state: {clicked: true}}},
        });
        expect(removed.config.items).toEqual(config.items);
        expect(removed.config.globalItems).toEqual([]);
        expect(rects(removed.config.layout)).toEqual(config.layout);
        expect(removed.itemsStateAndParams).toEqual({__meta__: {version: 2, queue: []}});
        expect(JSON.stringify(config)).toBe(before);
    });
});
