/** @jest-environment jsdom */
jest.mock('@gravity-ui/icons', () => ({Ellipsis: 'ellipsis', Gear: 'gear', Xmark: 'xmark'}));
jest.mock('@gravity-ui/uikit', () => ({
    Button: () => null,
    DropdownMenu: () => null,
    Icon: () => null,
}));

import assert from 'node:assert/strict';

import React from 'react';

import {act, fireEvent, render} from '@testing-library/react';

import type {Config} from '../../../shared';
import type {DashKitGroup, PluginRef, PluginWidgetProps} from '../../../typings';
import {DashKit} from '../DashKit';

const type = 'isolation-contract';
const settings = {autoupdateInterval: 0, silentLoading: false, isolateItemUpdates: true};
const reload = jest.fn();
class Widget extends React.Component<PluginWidgetProps, {clicks: number}> {
    state = {clicks: 0};
    render() {
        return (
            <button
                data-widget={this.props.id}
                onClick={() => this.setState(({clicks}) => ({clicks: clicks + 1}))}
            >
                {this.props.id}: {this.state.clicks}
            </button>
        );
    }
    getMeta = () => Promise.resolve(this.props.id);
    reload = (options: unknown) => reload(this.props.id, options);
}
const renderer = jest.fn(
    (props: PluginWidgetProps, ref: ((value: PluginRef) => void) | undefined) => (
        <Widget {...props} ref={ref} />
    ),
);
const config: Config = {
    salt: 'isolation',
    counter: 1,
    aliases: {},
    connections: [],
    items: ['a', 'b', 'c'].map((id) => ({id, type, namespace: 'default', data: {text: id}})),
    layout: ['a', 'b', 'c'].map((i, index) => ({i, x: index * 3, y: 0, w: 2, h: 2})),
};
const groups: DashKitGroup[] = ['g1', 'g2'].map((id) => ({
    id,
    gridProperties: () => ({
        cols: 12,
        rowHeight: 20,
        compactType: null,
        margin: [0, 0],
        containerPadding: [0, 0],
        resizeHandles: ['se'],
    }),
}));
const grouped: Config = {
    ...config,
    layout: config.layout.map((entry) => ({...entry, parent: entry.i === 'a' ? 'g1' : 'g2'})),
};
const count = (id: string) => renderer.mock.calls.filter(([props]) => props.id === id).length;
const latest = (id: string) => {
    const call = renderer.mock.calls.filter(([props]) => props.id === id).at(-1);
    assert(call);
    return call[0];
};

beforeAll(() => {
    DashKit.registerPlugins({type, defaultLayout: {w: 2, h: 2}, renderer});
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get: () => 600,
    });
});
beforeEach(() => {
    renderer.mockClear();
    reload.mockClear();
    DashKit.setSettings({isMobile: false});
});
afterEach(() => {
    jest.restoreAllMocks();
    DashKit.setSettings({isMobile: false});
});

// Critical: no. Renderer counts uniquely catch layout-only work that static checks miss.
test.each([undefined, false])(
    'default isolation=%s skips equal nested grid properties on visibility changes',
    (enabled) => {
        render(
            <DashKit
                config={grouped}
                groups={groups}
                editMode={false}
                settings={{...settings, isolateItemUpdates: enabled}}
            />,
        );
        const before = renderer.mock.calls.length;
        const hidden = jest.spyOn(document, 'hidden', 'get');
        for (const value of [true, false]) {
            hidden.mockReturnValue(value);
            fireEvent(document, new Event('visibilitychange'));
        }
        expect(renderer).toHaveBeenCalledTimes(before);
    },
);

describe.each([false, true])('isMobile=%s', (isMobile) => {
    beforeEach(() => DashKit.setSettings({isMobile}));

    test('isolates retained widgets when a sibling moves across groups', () => {
        const view = render(
            <DashKit config={grouped} groups={groups} editMode={false} settings={settings} />,
        );
        const button = view.getByText('b: 0');
        fireEvent.click(button);
        const before = {a: count('a'), b: count('b')};
        const moved = {
            ...grouped,
            layout: grouped.layout.map((entry) =>
                entry.i === 'c' ? {...entry, parent: 'g1'} : entry,
            ),
        };
        view.rerender(
            <DashKit config={moved} groups={groups} editMode={false} settings={settings} />,
        );
        expect({a: count('a'), b: count('b')}).toEqual(before);
        expect(view.getByText('b: 1')).toBe(button);
        expect(view.getByText('c: 0')).toBeTruthy();
    });

    test('isolates retained widgets when a preceding widget is removed', () => {
        const view = render(<DashKit config={config} editMode={false} settings={settings} />);
        const before = {b: count('b'), c: count('c')};
        const removed = {...config, items: config.items.slice(1), layout: config.layout.slice(1)};
        view.rerender(<DashKit config={removed} editMode={false} settings={settings} />);
        expect({b: count('b'), c: count('c')}).toEqual(before);
        expect(view.queryByText('a: 0')).toBeNull();
    });

    test('own data, state, params and layout remain current after sibling isolation', () => {
        const view = render(<DashKit config={config} editMode={false} settings={settings} />);
        const changed = {
            ...config,
            items: config.items.map((item) =>
                item.id === 'b' ? {...item, data: {text: 'changed'}} : item,
            ),
            layout: config.layout.map((entry) =>
                entry.i === 'b' ? {...entry, x: 4, h: 3} : entry,
            ),
        };
        const before = count('b');
        view.rerender(
            <DashKit
                config={changed}
                editMode={false}
                settings={settings}
                itemsStateAndParams={{b: {state: {selected: true}, params: {value: ['next']}}}}
            />,
        );
        expect(count('b')).toBeGreaterThan(before);
        expect(latest('b').data).toEqual({text: 'changed'});
        expect(latest('b').state).toEqual({selected: true});
        expect(latest('b').params.value).toEqual(['next']);
        expect(latest('b').layout.find(({i}) => i === 'b')).toMatchObject({x: 4, h: 3});
    });

    // Critical: yes. Lifecycle and retained completion callbacks must reach the current host.
    test('inline host callbacks stay current without rendering isolated widgets', () => {
        const ready = jest.fn();
        const mount = jest.fn();
        const fixture = (revision: number) => (
            <DashKit
                config={config}
                editMode={false}
                settings={settings}
                onItemRender={(item) => ready(revision, item.id)}
                onItemMountChange={(item, state) => mount(revision, item.id, state.isMounted)}
            />
        );
        const view = render(fixture(0));
        const complete = latest('b').onBeforeLoad();
        const before = renderer.mock.calls.length;
        view.rerender(fixture(1));
        expect(renderer).toHaveBeenCalledTimes(before);
        ready.mockClear();
        act(complete);
        expect(ready.mock.calls).toEqual([[1, 'b']]);
        mount.mockClear();
        view.unmount();
        expect(mount.mock.calls).toEqual(['a', 'b', 'c'].map((id) => [1, id, false]));
        ready.mockClear();
        act(complete);
        expect(ready).not.toHaveBeenCalled();
    });
});

// Critical: yes. Incorrect refs reload the wrong widget or return removed metadata.
test('desktop refs follow config order through group transfers, removal, reorder and re-add', async () => {
    const ref = React.createRef<DashKit>();
    const fixture = (value: Config) => (
        <DashKit ref={ref} config={value} groups={groups} editMode={false} settings={settings} />
    );
    const view = render(fixture(grouped));
    const current = () => {
        assert(ref.current);
        return ref.current;
    };
    const check = async (ids: string[]) => {
        expect(await Promise.all(current().getItemsMeta())).toEqual(ids);
        reload.mockClear();
        current().reloadItems({force: true});
        expect(reload.mock.calls.map(([id]) => id)).toEqual(ids);
    };
    await check(['a', 'b', 'c']);
    const moved = {
        ...grouped,
        layout: grouped.layout.map((entry) => (entry.i === 'c' ? {...entry, parent: 'g1'} : entry)),
    };
    view.rerender(fixture(moved));
    await check(['a', 'b', 'c']);
    const removed = {...moved, items: moved.items.slice(1), layout: moved.layout.slice(1)};
    view.rerender(fixture(removed));
    await check(['b', 'c']);
    reload.mockClear();
    current().reloadItems({force: true, targetIds: ['a', 'c']});
    expect(reload.mock.calls.map(([id]) => id)).toEqual(['c']);
    view.rerender(fixture({...removed, items: [...removed.items].reverse()}));
    await check(['c', 'b']);
    view.rerender(fixture(grouped));
    await check(['a', 'b', 'c']);
});
