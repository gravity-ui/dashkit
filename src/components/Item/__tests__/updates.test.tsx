/** @jest-environment jsdom */
import assert from 'node:assert/strict';

import React from 'react';

import {fireEvent, render} from '@testing-library/react';

import {DashKitContext} from '../../../context/DashKitContext';
import type {DashKitCtxShape} from '../../../context/DashKitContext';
import type {ConfigItem} from '../../../shared';
import type {PluginRef, PluginWidgetProps} from '../../../typings';
import {RegisterManager} from '../../../utils/register-manager';
import Item from '../Item';

class Widget extends React.Component<PluginWidgetProps, {clicks: number}> {
    state = {clicks: 0};
    render() {
        return (
            <div>
                <span>{this.props.data.text as string}</span>
                <button onClick={() => this.setState(({clicks}) => ({clicks: clicks + 1}))}>
                    Clicks {this.state.clicks}
                </button>
                <button
                    onClick={() =>
                        this.props.adjustWidgetLayout({
                            widgetId: this.props.id,
                            needSetDefault: true,
                        })
                    }
                >
                    Adjust
                </button>
                <button onClick={() => this.props.onStateAndParamsChange({state: {clicked: true}})}>
                    Params
                </button>
            </div>
        );
    }
}

function mountItem(isolateItemUpdates?: boolean) {
    const registerManager = new RegisterManager();
    const renderer = jest.fn(
        (props: PluginWidgetProps, ref: ((value: PluginRef) => void) | undefined) => (
            <Widget {...props} ref={ref} />
        ),
    );
    const item: ConfigItem = {
        id: 'widget',
        type: 'item-updates',
        namespace: 'default',
        data: {text: 'initial'},
    };
    registerManager.registerPlugin({type: item.type, renderer});
    const layout = [{i: item.id, x: 0, y: 0, w: 2, h: 2}];
    const settings = {autoupdateInterval: 0, silentLoading: false, isolateItemUpdates};
    const context: DashKitCtxShape = {
        config: {salt: 'updates', counter: 1, items: [item], layout, aliases: {}, connections: []},
        editMode: false,
        context: {},
        settings,
        globalParams: {},
        registerManager,
        forwardedMetaRef: null,
        externalLayoutRevision: 0,
        configItems: [item],
        layout,
        layoutChange: jest.fn(),
        temporaryLayout: null,
        memorizeOriginalLayout: jest.fn(),
        revertToOriginalLayout: jest.fn(),
        itemsState: {[item.id]: {}},
        itemsParams: {[item.id]: {}},
        onItemStateAndParamsChange: jest.fn(),
        getItemsMeta: jest.fn(),
        reloadItems: jest.fn(),
        onDrop: jest.fn(),
        onDropDragOver: jest.fn(),
        outerDnDEnable: false,
        dragOverPlugin: null,
    };
    const adjustWidgetLayout = jest.fn();
    const forwardedPluginRef = jest.fn();
    const fixture = (
        next = context,
        overrides: Partial<React.ComponentProps<typeof Item>> = {},
    ) => (
        <DashKitContext.Provider value={next}>
            <Item
                id={item.id}
                item={next.configItems[0]}
                layout={next.layout}
                shouldItemUpdate
                adjustWidgetLayout={adjustWidgetLayout}
                forwardedPluginRef={forwardedPluginRef}
                {...overrides}
            />
        </DashKitContext.Provider>
    );
    const view = render(fixture());
    const current = () => {
        const call = renderer.mock.calls.at(-1);
        assert(call);
        return call[0];
    };
    return {context, item, renderer, registerManager, fixture, view, current, forwardedPluginRef};
}

// Critical: yes. Sibling layout changes must not re-run isolated widget renderers with stable own props.
test('opt-in skips sibling layout changes with stable callbacks and preserves own data, state, params and geometry updates', () => {
    const {context, item, renderer, fixture, view, current} = mountItem(true);
    let next = context;
    const update = (patch: Partial<DashKitCtxShape>) => {
        next = {...next, ...patch};
        view.rerender(fixture(next));
    };
    const selector = {...item, id: 'selector'};
    const selectorLayout = {i: selector.id, x: 8, y: 0, w: 2, h: 2};
    update({configItems: [item, selector], layout: [...context.layout, selectorLayout]});
    update({layout: [...context.layout, {...selectorLayout, x: 9}]});
    update({configItems: [item], layout: context.layout.map((entry) => ({...entry}))});
    expect(renderer).toHaveBeenCalledTimes(1);
    update({layout: [{...context.layout[0], x: 1}]});
    expect(renderer).toHaveBeenCalledTimes(2);
    expect(current().layout[0].x).toBe(1);
    update({configItems: [{...item, data: {text: 'own edit'}}]});
    expect(renderer).toHaveBeenCalledTimes(3);
    expect(view.getByText('own edit')).toBeTruthy();
    update({itemsState: {[item.id]: {selected: true}}});
    expect(renderer).toHaveBeenCalledTimes(4);
    expect(current().state).toEqual({selected: true});
    update({itemsParams: {[item.id]: {value: ['updated']}}});
    expect(renderer).toHaveBeenCalledTimes(5);
    expect(current().params).toEqual({value: ['updated']});
});

test.each([undefined, false])(
    'default isolateItemUpdates=%s retains full-layout renderer updates',
    (enabled) => {
        const {context, item, renderer, fixture, view, current} = mountItem(enabled);
        view.rerender(
            fixture({
                ...context,
                layout: [...context.layout, {i: 'selector', x: 4, y: 0, w: 2, h: 2}],
            }),
        );
        expect(renderer).toHaveBeenCalledTimes(2);
        expect(current().layout).toHaveLength(2);
        view.rerender(fixture({...context, configItems: [{...item}], layout: [...context.layout]}));
        expect(renderer).toHaveBeenCalledTimes(3);
        expect(current().layout).toEqual(context.layout);
    },
);

test('toggling the opt-in preserves the widget instance and default rendering resumes', () => {
    const {context, renderer, fixture, view, forwardedPluginRef} = mountItem(false);
    const button = view.getByText('Clicks 0');
    fireEvent.click(button);
    const ref = forwardedPluginRef.mock.calls[0][0];
    const isolated = {...context, settings: {...context.settings, isolateItemUpdates: true}};
    view.rerender(fixture(isolated));
    const count = renderer.mock.calls.length;
    const layout = [...context.layout, {i: 'selector', x: 4, y: 0, w: 2, h: 2}];
    view.rerender(fixture({...isolated, layout}));
    expect(renderer).toHaveBeenCalledTimes(count);
    expect(view.getByText('Clicks 1')).toBe(button);
    expect(forwardedPluginRef).toHaveBeenCalledTimes(1);
    expect(forwardedPluginRef.mock.calls[0][0]).toBe(ref);
    view.rerender(fixture({...context, layout}));
    expect(renderer).toHaveBeenCalledTimes(count + 1);
    view.rerender(fixture({...context, layout: [...layout]}));
    expect(renderer).toHaveBeenCalledTimes(count + 2);
    expect(view.getByText('Clicks 1')).toBe(button);
});

test('own settings, context, grid and callbacks remain live with isolation enabled', () => {
    const {context, renderer, fixture, view, current} = mountItem(true);
    let next = {...context, context: {label: 'changed'}};
    view.rerender(fixture(next));
    expect(renderer).toHaveBeenCalledTimes(2);
    expect(current().context).toEqual({label: 'changed'});
    next = {...next, settings: {...next.settings, silentLoading: true}};
    view.rerender(fixture(next));
    expect(renderer).toHaveBeenCalledTimes(3);
    expect(current().settings.silentLoading).toBe(true);
    const adjustWidgetLayout = jest.fn();
    const ready = jest.fn();
    const forwardedPluginRef = jest.fn();
    view.rerender(
        fixture(next, {
            adjustWidgetLayout,
            onItemRender: ready,
            forwardedPluginRef,
            gridLayout: {cols: 24},
        }),
    );
    expect(renderer).toHaveBeenCalledTimes(4);
    expect(current().gridLayout.cols).toBe(24);
    expect(forwardedPluginRef).toHaveBeenCalledTimes(1);
    fireEvent.click(view.getByText('Adjust'));
    expect(adjustWidgetLayout).toHaveBeenCalledWith({widgetId: 'widget', needSetDefault: true});
    current().onBeforeLoad()();
    expect(ready).toHaveBeenCalledTimes(1);
    const onItemStateAndParamsChange = jest.fn();
    view.rerender(fixture({...next, onItemStateAndParamsChange}));
    fireEvent.click(view.getByText('Params'));
    expect(onItemStateAndParamsChange).toHaveBeenCalledWith(
        'widget',
        {state: {clicked: true}},
        undefined,
    );
});

test('registry plugin reload invalidates isolation without replacing the mounted widget', () => {
    const {context, item, renderer, registerManager, fixture, view, forwardedPluginRef} =
        mountItem(true);
    const button = view.getByText('Clicks 0');
    fireEvent.click(button);
    const replacement = jest.fn(
        (props: PluginWidgetProps, ref: ((value: PluginRef) => void) | undefined) => (
            <Widget {...props} ref={ref} />
        ),
    );
    registerManager.reloadPlugin({type: item.type, renderer: replacement});
    view.rerender(fixture({...context}));
    expect(renderer).toHaveBeenCalledTimes(1);
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(view.getByText('Clicks 1')).toBe(button);
    expect(forwardedPluginRef).toHaveBeenCalledTimes(1);
});
