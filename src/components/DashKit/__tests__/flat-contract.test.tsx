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
import {DashKitGridStack} from '../../GridStack/DashKitGridStack';
import {validateConfig} from '../../GridStack/document';
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
                <button
                    onClick={() =>
                        this.context.layoutChange(
                            this.context.layout.map(
                                ({parent: _parent, ...layoutEntry}) => layoutEntry,
                            ),
                        )
                    }
                >
                    No-op {this.props.id}
                </button>
                <output data-layout={this.props.id}>{JSON.stringify(this.props.layout)}</output>
                <output data-context-layout={this.props.id}>
                    {JSON.stringify(this.context.layout)}
                </output>
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
const LAYOUT_ENGINES = [
    ['legacy', DashKit],
    ['gridstack', DashKitGridStack],
] as const;
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
        Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
            configurable: true,
            value: () => {},
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
            let width = entry ? Number(entry.dataset.dashkitGridW) * 50 : 600;
            let height = entry ? Number(entry.dataset.dashkitGridH) * 20 : 400;
            // GridStack measures this native 1px reference to calculate CSS scale.
            if (this.style.width === '1px') {
                width = 1;
            }
            if (this.style.height === '1px') {
                height = 1;
            }
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

    // Critical: yes. Idle acknowledgment must deliver saved geometry to plugin props and context.
    test.each(['same', 'clone'] as const)(
        '%s idle acknowledgment delivers moved and resized layout',
        async (acknowledgment) => {
            const original = JSON.stringify(config);
            const onChange = jest.fn();
            const view = render(
                <Component config={config} groups={groups} editMode onChange={onChange} />,
            );
            const acknowledge = (expected: {x: number; y: number; w: number; h: number}) => {
                const saved: Config = onChange.mock.calls.at(-1)[0].config;
                const before = JSON.stringify(saved);
                const accepted = acknowledgment === 'same' ? saved : JSON.parse(before);
                view.rerender(
                    <Component config={accepted} groups={groups} editMode onChange={onChange} />,
                );
                expect(saved.layout[0]).toMatchObject(expected);
                expect(geometry(view.container, 'a')).toEqual(expected);
                for (const selector of ['data-layout', 'data-context-layout']) {
                    expect(rects(jsonOutput(view.container, `[${selector}="a"]`))).toEqual(
                        rects(saved.layout),
                    );
                }
                expect(JSON.stringify(saved)).toBe(before);
                expect(JSON.stringify(accepted)).toBe(before);
                expect(JSON.stringify(config)).toBe(original);
            };
            await drag(view.container, 'a', 50);
            acknowledge({x: 1, y: 0, w: 2, h: 2});
            expect(onChange).toHaveBeenCalledTimes(1);
            const handle = view.container.querySelector(
                '[data-qa="dashkit-grid-item"] .react-resizable-handle-se, [data-dashkit-id="a"] > .ui-resizable-se',
            );
            assert(handle);
            fireEvent.mouseDown(handle, {button: 0, clientX: 150, clientY: 40, buttons: 1});
            fireEvent.mouseMove(document, {clientX: 200, clientY: 60, buttons: 1});
            fireEvent.mouseUp(document, {clientX: 200, clientY: 60});
            await act(async () => {
                await Promise.resolve();
            });
            acknowledge({x: 1, y: 0, w: 3, h: 3});
            expect(onChange).toHaveBeenCalledTimes(2);
        },
    );

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
        const beforeGesture = {
            config: currentDocument,
            itemsStateAndParams: JSON.parse(JSON.stringify(currentState)),
        };
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
        let instance: DashKit | DashKitGridStack | null = null;
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
        let instance: DashKit | DashKitGridStack | null = null;
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
    // Critical: no. Partial callbacks must keep rendered defaults and numeric styles.
    test('partial group properties retain default geometry and numeric styles', () => {
        const view = render(
            <Component
                config={config}
                groups={[{gridProperties: () => ({style: {height: 400, width: 600}})}]}
                editMode
            />,
        );
        const widget = view.container.querySelector<HTMLElement>('[data-qa="dashkit-grid-item"]');
        assert(widget);
        expect(widget.dataset.dashkitGridCols).toBe('12');
        expect(widget.dataset.dashkitGridRowHeight).toBe('150');
        expect(widget.dataset.dashkitGridMarginX).toBe('10');
        expect(widget.dataset.dashkitGridPaddingY).toBe('10');
        const zone = view.container.querySelector<HTMLElement>('.react-grid-layout');
        assert(zone);
        const styled = zone.style.width === '600px' ? zone : zone.parentElement;
        expect(styled?.style.height).toBe('400px');
        expect(styled?.style.width).toBe('600px');
    });

    // Critical: yes. A view mounted with refresh enabled must deliver fresh data through live refs.
    test('initial positive refresh, periodic reload, force targets and cleanup use current refs', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        const ref = React.createRef<DashKit | DashKitGridStack>();
        const original = JSON.stringify(config);
        const view = render(
            <Component
                ref={ref}
                config={config}
                groups={groups}
                editMode={false}
                settings={{autoupdateInterval: 1, silentLoading: true}}
            />,
        );
        try {
            expect(reload.mock.calls).toEqual([
                ['a', {silentLoading: true, noVeil: true}],
                ['b', {silentLoading: true, noVeil: true}],
            ]);
            assert(ref.current);
            const metadata = await Promise.all(ref.current.getItemsMeta());
            act(() => jest.advanceTimersByTime(999));
            expect(reload).toHaveBeenCalledTimes(2);
            act(() => jest.advanceTimersByTime(1));
            expect(reload.mock.calls.slice(2)).toEqual([
                ['a', {silentLoading: true, noVeil: true}],
                ['b', {silentLoading: true, noVeil: true}],
            ]);
            ref.current.reloadItems({targetIds: ['b'], force: true});
            expect(reload).toHaveBeenCalledTimes(5);
            expect(reload.mock.calls.at(-1)).toEqual(['b', {silentLoading: true, noVeil: true}]);
            expect(await Promise.all(ref.current.getItemsMeta())).toEqual(metadata);
            expect(JSON.stringify(config)).toBe(original);
            view.unmount();
            act(() => jest.advanceTimersByTime(5000));
            expect(reload).toHaveBeenCalledTimes(5);
        } finally {
            view.unmount();
            hidden.mockRestore();
            jest.useRealTimers();
        }
    });

    // Critical: yes. A disabled refresh clock must not delay newly enabled live data.
    test('reload timing, force targets, visibility, editing and cleanup share the same clock', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        const ref = React.createRef<DashKit | DashKitGridStack>();
        const fixture = (interval: number, editing = false) => (
            <Component
                ref={ref}
                config={config}
                groups={groups}
                editMode={editing}
                settings={{autoupdateInterval: interval, silentLoading: true}}
            />
        );
        const view = render(fixture(0));
        try {
            expect(reload).not.toHaveBeenCalled();
            assert(ref.current);
            ref.current.reloadItems({targetIds: ['missing'], force: true});
            expect(reload).not.toHaveBeenCalled();
            ref.current.reloadItems({targetIds: ['b'], force: true});
            expect(reload.mock.calls).toEqual([['b', {silentLoading: true, noVeil: true}]]);
            view.rerender(fixture(1));
            expect(reload).toHaveBeenCalledTimes(3);
            act(() => jest.advanceTimersByTime(999));
            expect(reload).toHaveBeenCalledTimes(3);
            act(() => jest.advanceTimersByTime(1));
            expect(reload).toHaveBeenCalledTimes(5);
            hidden.mockReturnValue(true);
            fireEvent(document, new Event('visibilitychange'));
            act(() => jest.advanceTimersByTime(1100));
            expect(reload).toHaveBeenCalledTimes(5);
            ref.current.reloadItems({targetIds: ['a'], force: true});
            expect(reload).toHaveBeenCalledTimes(6);
            expect(reload.mock.calls.at(-1)).toEqual(['a', {silentLoading: true, noVeil: true}]);
            hidden.mockReturnValue(false);
            fireEvent(document, new Event('visibilitychange'));
            view.rerender(fixture(1, true));
            act(() => jest.advanceTimersByTime(1100));
            expect(reload).toHaveBeenCalledTimes(6);
            view.rerender(fixture(1));
            expect(reload).toHaveBeenCalledTimes(8);
            view.unmount();
            act(() => jest.advanceTimersByTime(5000));
            expect(reload).toHaveBeenCalledTimes(8);
        } finally {
            view.unmount();
            hidden.mockRestore();
            jest.useRealTimers();
        }
    });

    // Critical: yes. Controlled zone pin/reveal must deliver live metadata without an echo save.
    test('controlled pin into a newly introduced zone and restore keep live refs', async () => {
        const ref = React.createRef<DashKit | DashKitGridStack>();
        const onChange = jest.fn();
        const fixture = (document: Config, zones: DashKitGroup[]) => (
            <Component ref={ref} config={document} groups={zones} editMode onChange={onChange} />
        );
        const view = render(fixture(config, groups));
        const pinned = {
            ...config,
            layout: config.layout.map((entry) => ({...entry, parent: 'fixed'})),
        };
        view.rerender(fixture(pinned, [{...groups[0], id: 'fixed'}, ...groups]));
        assert(ref.current);
        const meta = await Promise.all(ref.current.getItemsMeta());
        expect(meta.map(({id}) => id).sort()).toEqual(['a', 'b']);
        expect(view.container.querySelectorAll('[data-widget]')).toHaveLength(2);
        expect(onChange).not.toHaveBeenCalled();
        view.rerender(fixture(config, [{...groups[0], id: 'fixed'}, ...groups]));
        assert(ref.current);
        expect((await Promise.all(ref.current.getItemsMeta())).map(({id}) => id).sort()).toEqual([
            'a',
            'b',
        ]);
        expect(onChange).not.toHaveBeenCalled();
    });

    // Critical: no. Omitting an optional default-zone key is not a saved layout change.
    test('default-zone optional keys do not emit a no-op change', () => {
        const onChange = jest.fn();
        const event = jest.fn();
        let instance: DashKit | DashKitGridStack | null = null;
        const view = render(
            <Component
                ref={(value) => {
                    instance = value;
                }}
                config={config}
                groups={groups}
                editMode
                onChange={onChange}
            />,
        );
        assert(instance);
        (instance as DashKit | DashKitGridStack).on('change', event);
        fireEvent.click(view.getByText('No-op a'));
        expect(event).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });
    // Critical: yes. Reflow collision priority must preserve the same saved document in both engines.
    test.each(['vertical', 'horizontal', 'horizontal-nowrap'] as const)(
        '%s static reflow preserves collision, gaps and row-wrap priority',
        (compactType) => {
            const fixtures: Config['layout'][] = [
                [
                    {i: 'a', x: 0, y: 0, w: 3, h: 1},
                    {i: 'b', x: 0, y: 0, w: 3, h: 1},
                ],
                [
                    {i: 'a', x: 0, y: 0, w: 8, h: 2},
                    {i: 'b', x: 2, y: 0, w: 6, h: 2},
                    {i: 'c', x: 4, y: 0, w: 4, h: 1},
                ],
                [
                    {i: 'a', x: 4, y: 2, w: 4, h: 2},
                    {i: 'b', x: 9, y: 0, w: 3, h: 3},
                    {i: 'c', x: 8, y: 2, w: 4, h: 2},
                ],
            ];
            const zones: DashKitGroup[] = [{gridProperties: () => ({cols: 12, compactType})}];
            for (const layout of fixtures) {
                const before = JSON.stringify(layout);
                const options = {layout: layout.map((entry) => ({...entry})), groups: zones};
                expect(rects(Component.reflowLayout(options))).toEqual(
                    rects(
                        DashKit.reflowLayout({
                            ...options,
                            layout: layout.map((entry) => ({...entry})),
                        }),
                    ),
                );
                const newLayoutItem = {i: 'new', x: 0, y: 0, w: 4, h: 2};
                expect(
                    rects(
                        Component.reflowLayout({
                            ...options,
                            layout: layout.map((entry) => ({...entry})),
                            newLayoutItem: {...newLayoutItem},
                        }),
                    ),
                ).toEqual(
                    rects(
                        DashKit.reflowLayout({
                            ...options,
                            layout: layout.map((entry) => ({...entry})),
                            newLayoutItem: {...newLayoutItem},
                        }),
                    ),
                );
                expect(JSON.stringify(layout)).toBe(before);
            }
        },
    );
    // Critical: yes. A new widget must keep its priority and saved item ordering on insertion.
    test.each(['vertical', 'horizontal'] as const)(
        '%s setItem keeps new-item priority and canonical order',
        (compactType) => {
            const original = {...config, items: [config.items[0]], layout: [config.layout[0]]};
            const options = {
                config: original,
                item: {type, data: {}, layout: {x: 0, y: 0, w: 2, h: 2}},
                groups: [{gridProperties: () => ({cols: 12, compactType})}],
            };
            const before = JSON.stringify(original);
            const next = Component.setItem(options);
            const legacy = DashKit.setItem(options);
            expect(next.items).toEqual(legacy.items);
            expect(rects(next.layout)).toEqual(rects(legacy.layout));
            expect(next.layout.map(({i}) => i)).toEqual(next.items.map(({id}) => id));
            expect(JSON.stringify(original)).toBe(before);
        },
    );
    // Critical: yes. A rejected collision must not move a neighbor or poison the next saved edit.
    test('blocked collision retains both widgets and accepts the next valid drag', async () => {
        const onChange = jest.fn();
        const collisionGroups: DashKitGroup[] = [
            {
                gridProperties: () => ({
                    cols: 12,
                    rowHeight: 20,
                    margin: [0, 0],
                    containerPadding: [0, 0],
                    compactType: null,
                    preventCollision: true,
                }),
            },
        ];
        const view = render(
            <Component config={config} groups={collisionGroups} editMode onChange={onChange} />,
        );
        const widgets = [...view.container.querySelectorAll('[data-widget]')];
        await drag(view.container, 'a', 300);
        expect(onChange).not.toHaveBeenCalled();
        expect(geometry(view.container, 'a')).toEqual({x: 0, y: 0, w: 2, h: 2});
        expect(geometry(view.container, 'b')).toEqual({x: 6, y: 0, w: 2, h: 2});
        await drag(view.container, 'a', 50);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(rects(onChange.mock.calls[0][0].config.layout)).toEqual([
            {...config.layout[0], x: 1},
            config.layout[1],
        ]);
        expect([...view.container.querySelectorAll('[data-widget]')]).toEqual(widgets);
    });
    // Critical: yes. Native resize must enforce plugin bounds without replacing a live widget.
    test('mounted resize clamps to the same minimum and maximum plugin bounds', async () => {
        const limitedType = 'flat-contract-limited';
        Component.reloadPlugins({
            type: limitedType,
            defaultLayout: {w: 2, h: 2, minW: 2, minH: 2, maxW: 3, maxH: 3},
            renderer: (props, ref) => <Widget {...props} ref={ref} />,
        });
        let current = {
            ...config,
            items: [{...config.items[0], type: limitedType}],
            layout: [config.layout[0]],
        };
        const onChange = jest.fn();
        const view = render(
            <Component config={current} groups={groups} editMode onChange={onChange} />,
        );
        const widget = view.container.querySelector('[data-widget="a"]');
        const resize = async (dx: number, dy: number) => {
            const handle = view.container.querySelector(
                '[data-qa="dashkit-grid-item"] .react-resizable-handle-se, [data-dashkit-id="a"] > .ui-resizable-se',
            );
            assert(handle);
            const entry = geometry(view.container, 'a');
            const x = (entry.x + entry.w) * 50;
            const y = (entry.y + entry.h) * 20;
            fireEvent.mouseDown(handle, {button: 0, clientX: x, clientY: y, buttons: 1});
            fireEvent.mouseMove(document, {clientX: x + dx, clientY: y + dy, buttons: 1});
            fireEvent.mouseUp(document, {clientX: x + dx, clientY: y + dy});
            await act(async () => {
                await Promise.resolve();
            });
        };
        await resize(250, 200);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(geometry(view.container, 'a')).toEqual({x: 0, y: 0, w: 3, h: 3});
        current = onChange.mock.calls[0][0].config;
        view.rerender(<Component config={current} groups={groups} editMode onChange={onChange} />);
        await resize(-250, -200);
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(geometry(view.container, 'a')).toEqual({x: 0, y: 0, w: 2, h: 2});
        expect(rects(onChange.mock.calls[1][0].config.layout)).toEqual(config.layout.slice(0, 1));
        expect(view.container.querySelector('[data-widget="a"]')).toBe(widget);
    });
});

// Critical: yes. Removal must retain the remaining widget's saved geometry and state.
describe.each([
    ['legacy flat', DashKit, false],
    ['GridStack flat', DashKitGridStack, false],
    ['GridStack nested', DashKitGridStack, true],
] as const)('%s removal with reordered layout', (_name, Component, nested) => {
    test.each([1, 2])('version %s removes the selected local or global item', (version) => {
        for (const global of [false, true]) {
            const a = {...config.items[0], defaults: {value: ['initial'], removedOnly: ['a']}};
            const b = config.items[1];
            const layout = [...config.layout]
                .reverse()
                .map((entry) => (nested ? {...entry, containerId: 'box'} : entry));
            const original: Config = {
                ...config,
                aliases: {default: [['value', 'alias']]},
                connections: [
                    {from: 'a', to: 'b', kind: 'ignore'},
                    {from: 'b', to: 'b', kind: 'ignore'},
                ],
                items: global ? [b] : [a, b],
                globalItems: global ? [a] : [],
                layout,
                ...(nested
                    ? {
                          layoutVersion: 2,
                          containers: [
                              {
                                  id: 'box',
                                  x: 0,
                                  y: 0,
                                  w: 12,
                                  h: 6,
                                  padding: [0, 0, 0, 0],
                                  gap: [0, 0],
                                  grid: {cols: 12, rowHeight: 20, compactType: null},
                              },
                          ],
                      }
                    : {}),
            };
            const state: ItemsStateAndParams = {
                a: {params: {value: ['a']}},
                b: {params: {value: ['b'], removedOnly: ['stale']}},
                __meta__: {version, queue: []},
            };
            const before = JSON.stringify({original, state});
            if (Component === DashKitGridStack) {
                expect(() => validateConfig(original)).not.toThrow();
            }
            const result = Component.removeItem({
                config: original,
                id: 'a',
                itemsStateAndParams: state,
            });
            expect(result.config.items).toEqual([b]);
            expect(result.config.globalItems).toEqual([]);
            expect(result.config.layout).toEqual([layout[0]]);
            expect(result.config.connections).toEqual([{from: 'b', to: 'b', kind: 'ignore'}]);
            expect(result.config.aliases).toEqual(original.aliases);
            expect(result.itemsStateAndParams).toEqual({
                b: {
                    params: version === 1 ? {value: ['b']} : {value: ['b'], removedOnly: ['stale']},
                },
                __meta__: {version, queue: []},
            });
            if (Component === DashKitGridStack) {
                expect(() => validateConfig(result.config)).not.toThrow();
            }
            expect(JSON.stringify({original, state})).toBe(before);
        }
    });
});
