/** @jest-environment jsdom */
jest.mock('@gravity-ui/icons', () => ({Ellipsis: 'ellipsis', Gear: 'gear', Xmark: 'xmark'}));
jest.mock('@gravity-ui/uikit', () => {
    const ReactMock = require('react');
    return {
        Button: ({children}: {children?: unknown}) =>
            ReactMock.createElement('button', null, children),
        DropdownMenu: () => null,
        Icon: () => null,
    };
});

import assert from 'node:assert/strict';

import React from 'react';

import {act, fireEvent, render} from '@testing-library/react';

import {DashKitContext} from '../../../context';
import type {Config} from '../../../shared';
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
            componentDidMount() {
                completions.push(this.props.onBeforeLoad());
            }
            componentDidUpdate(previous: PluginWidgetProps) {
                if (previous.data !== this.props.data) {
                    completions.push(this.props.onBeforeLoad());
                }
            }
            render() {
                return <span>{this.props.data.text as string}</span>;
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
