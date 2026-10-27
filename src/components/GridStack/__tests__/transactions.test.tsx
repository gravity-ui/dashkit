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
