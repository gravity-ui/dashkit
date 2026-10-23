/** @jest-environment jsdom */
import React from 'react';

import {act, render} from '@testing-library/react';

import {DashKitContext} from '../../../context/DashKitContext';
import type {DashKitCtxShape} from '../../../context/DashKitContext';
import type {ConfigItem} from '../../../shared';
import type {PluginWidgetProps} from '../../../typings';
import {RegisterManager} from '../../../utils/register-manager';
import Item from '../Item';

// Critical: yes. Stale readiness can export unfinished content or signal a removed widget as ready.
test('only the latest live async load marks the current item ready', () => {
    const completions: Array<() => void> = [];
    class AsyncPlugin extends React.Component<PluginWidgetProps> {
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
    const registerManager = new RegisterManager();
    registerManager.registerPlugin({
        type: 'async-readiness',
        renderer: (props) => <AsyncPlugin {...props} />,
    });
    const item: ConfigItem = {
        id: 'async',
        type: 'async-readiness',
        namespace: 'default',
        data: {text: 'initial'},
    };
    const context: DashKitCtxShape = {
        config: {salt: 'test', counter: 1, items: [item], layout: [], aliases: {}, connections: []},
        editMode: false,
        context: {},
        settings: {autoupdateInterval: 0, silentLoading: false},
        globalParams: {},
        registerManager,
        forwardedMetaRef: null,
        externalLayoutRevision: 0,
        configItems: [item],
        layout: [],
        layoutChange: jest.fn(),
        temporaryLayout: null,
        memorizeOriginalLayout: jest.fn(),
        revertToOriginalLayout: jest.fn(),
        itemsState: {async: {}},
        itemsParams: {async: {}},
        onItemStateAndParamsChange: jest.fn(),
        getItemsMeta: jest.fn(),
        reloadItems: jest.fn(),
        onDrop: jest.fn(),
        onDropDragOver: jest.fn(),
        outerDnDEnable: false,
        dragOverPlugin: null,
    };
    const mounted = jest.fn();
    const ready = jest.fn();
    const adjustWidgetLayout = jest.fn();
    const fixture = (current: ConfigItem) => (
        <DashKitContext.Provider value={context}>
            <Item
                id={current.id}
                item={current}
                layout={context.layout}
                shouldItemUpdate
                adjustWidgetLayout={adjustWidgetLayout}
                onItemMountChange={mounted}
                onItemRender={ready}
            />
        </DashKitContext.Provider>
    );
    const view = render(fixture(item));
    expect(view.getByText('initial')).toBeTruthy();
    expect(completions).toHaveLength(1);
    expect(mounted).toHaveBeenCalledWith(item, {isAsync: true, isMounted: true});
    expect(ready).not.toHaveBeenCalled();

    const latest = {...item, data: {text: 'latest'}};
    view.rerender(fixture(latest));
    expect(view.getByText('latest')).toBeTruthy();
    expect(completions).toHaveLength(2);
    act(() => completions[0]());
    expect(ready).not.toHaveBeenCalled();
    act(() => completions[1]());
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenLastCalledWith(latest);

    view.unmount();
    act(() => completions[1]());
    expect(ready).toHaveBeenCalledTimes(1);
    expect(mounted).toHaveBeenLastCalledWith(latest, {isAsync: true, isMounted: false});
});
