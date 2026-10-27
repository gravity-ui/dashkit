/** @jest-environment jsdom */
jest.mock('@gravity-ui/uikit', () => {
    const ReactMock = require('react');
    return {
        Loader: () => ReactMock.createElement('span', null, 'loading'),
        Button: ({children}: {children?: unknown}) =>
            ReactMock.createElement('button', null, children),
    };
});

import React from 'react';

import {act, fireEvent, render} from '@testing-library/react';

import {DashKitContext} from '../../../context/DashKitContext';
import type {DashKitCtxShape} from '../../../context/DashKitContext';
import {PluginText} from '../../../plugins/Text/Text';
import type {ConfigItem} from '../../../shared';
import type {PluginWidgetProps} from '../../../typings';
import {RegisterManager} from '../../../utils/register-manager';
import MobileLayout from '../../MobileLayout/MobileLayout';
import Item from '../Item';

function createContext(item: ConfigItem, registerManager: RegisterManager): DashKitCtxShape {
    return {
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
}

// Critical: yes. Stale readiness can export unfinished content or signal a removed widget as ready.
test('only the latest live async load marks the current item ready', () => {
    const completions: Array<() => void> = [];
    class AsyncPlugin extends React.Component<PluginWidgetProps> {
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
    const context = createContext(item, registerManager);
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

    const replacement = {...latest, id: 'replacement', data: {text: 'replacement'}};
    view.rerender(fixture(replacement));
    act(() => completions[2]());
    expect(ready).toHaveBeenCalledTimes(2);
    expect(ready).toHaveBeenLastCalledWith(replacement);
    act(() => completions[1]());
    expect(ready).toHaveBeenCalledTimes(2);

    view.rerender(fixture(latest));
    act(() => completions[3]());
    expect(ready).toHaveBeenCalledTimes(3);
    expect(ready).toHaveBeenLastCalledWith(latest);
    act(() => completions[1]());
    expect(ready).toHaveBeenCalledTimes(3);

    view.unmount();
    act(() => completions[3]());
    expect(ready).toHaveBeenCalledTimes(3);
    expect(mounted).toHaveBeenLastCalledWith(latest, {isAsync: true, isMounted: false});
});

// Critical: yes. Render-only acquisitions must not suppress a real request's completion.
test('functional plugin rerender does not suppress its live request', () => {
    let completeRequest!: () => void;
    function AsyncPlugin(props: PluginWidgetProps) {
        const {onBeforeLoad} = props;
        onBeforeLoad();
        React.useEffect(() => {
            completeRequest = onBeforeLoad();
        }, [onBeforeLoad]);
        return <span>{props.data.text as string}</span>;
    }
    const registerManager = new RegisterManager();
    registerManager.registerPlugin({
        type: 'functional-async',
        renderer: (props) => <AsyncPlugin {...props} />,
    });
    const item: ConfigItem = {
        id: 'async',
        type: 'functional-async',
        namespace: 'default',
        data: {text: 'initial'},
    };
    const context = createContext(item, registerManager);
    const ready = jest.fn();
    const fixture = (current: ConfigItem) => (
        <DashKitContext.Provider value={context}>
            <Item
                id={current.id}
                item={current}
                layout={context.layout}
                shouldItemUpdate
                adjustWidgetLayout={jest.fn()}
                onItemRender={ready}
            />
        </DashKitContext.Provider>
    );
    const view = render(fixture(item));
    expect(ready).not.toHaveBeenCalled();
    view.rerender(fixture({...item, data: {text: 'rerendered'}}));
    act(() => completeRequest());
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledWith(expect.objectContaining({data: {text: 'rerendered'}}));
});

// Critical: yes. Item identity and unmount still reject callbacks retained by external plugins.
test('completion from previous item id or unmounted item stays silent', () => {
    const completions: Array<() => void> = [];
    const registerManager = new RegisterManager();
    registerManager.registerPlugin({
        type: 'identity-async',
        renderer: (props) => {
            completions.push(props.onBeforeLoad());
            return <span>{props.id}</span>;
        },
    });
    const item: ConfigItem = {
        id: 'old',
        type: 'identity-async',
        namespace: 'default',
        data: {},
    };
    const context = createContext(item, registerManager);
    const ready = jest.fn();
    const fixture = (current: ConfigItem) => (
        <DashKitContext.Provider value={context}>
            <Item
                id={current.id}
                item={current}
                layout={context.layout}
                shouldItemUpdate
                adjustWidgetLayout={jest.fn()}
                onItemRender={ready}
            />
        </DashKitContext.Provider>
    );
    const view = render(fixture(item));
    const replacement = {...item, id: 'new'};
    view.rerender(fixture(replacement));
    act(() => completions[0]());
    expect(ready).not.toHaveBeenCalled();
    act(() => completions[1]());
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledWith(replacement);
    view.unmount();
    act(() => completions[1]());
    expect(ready).toHaveBeenCalledTimes(1);
});

test('mobile layout updates same-id type with unchanged layout reference', () => {
    let completeOld!: () => void;
    const registerManager = new RegisterManager();
    registerManager.registerPlugin({
        type: 'mobile-async',
        renderer: (props) => {
            completeOld = props.onBeforeLoad();
            return <span>Mobile pending</span>;
        },
    });
    registerManager.registerPlugin({
        type: 'mobile-sync',
        renderer: () => <span>Mobile ready</span>,
    });
    const item: ConfigItem = {
        id: 'async',
        type: 'mobile-async',
        namespace: 'default',
        data: {},
    };
    const context = createContext(item, registerManager);
    const ready = jest.fn();
    const mounted = jest.fn();
    const fixture = (current: ConfigItem) => (
        <DashKitContext.Provider
            value={{
                ...context,
                config: {...context.config, items: [current]},
                configItems: [current],
                onItemRender: ready,
                onItemMountChange: mounted,
            }}
        >
            <MobileLayout />
        </DashKitContext.Provider>
    );
    const view = render(fixture(item));
    expect(ready).not.toHaveBeenCalled();
    const replacement = {...item, type: 'mobile-sync'};
    view.rerender(fixture(replacement));
    expect(view.getByText('Mobile ready')).toBeTruthy();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledWith(expect.objectContaining(replacement));
    act(() => completeOld());
    expect(ready).toHaveBeenCalledTimes(1);
    expect(mounted).toHaveBeenCalledWith(expect.objectContaining(item), {
        isAsync: true,
        isMounted: false,
    });
    expect(mounted).toHaveBeenCalledWith(expect.objectContaining(replacement), {
        isAsync: false,
        isMounted: true,
    });
});

// Critical: yes. Regression: retained readiness callbacks stop reporting post-processing/style changes.
// Impact: unfinished preview/export. Unique protection: real Text and its wrapper acquire separately.
test.each(['success', 'failure'] as const)(
    'retained wrapper notifications survive real Text loads and obsolete %s',
    async (outcome) => {
        function pending() {
            let resolve!: (result: {result: string}) => void;
            let reject!: (error: Error) => void;
            const promise = new Promise<{result: string}>((yes, no) => {
                resolve = yes;
                reject = no;
            });
            return {promise, resolve, reject};
        }
        const initial = pending();
        const obsolete = pending();
        const latest = pending();
        let retainedCompletion!: () => void;
        function TextWrapper(props: PluginWidgetProps) {
            const {onBeforeLoad} = props;
            const completionRef = React.useRef<(() => void) | undefined>(undefined);
            const pendingRef = React.useRef(false);
            React.useEffect(() => {
                completionRef.current = onBeforeLoad();
                retainedCompletion = completionRef.current;
            }, [onBeforeLoad]);
            const handleBeforeLoad = () => {
                pendingRef.current = true;
                const complete = onBeforeLoad();
                return () => {
                    pendingRef.current = false;
                    complete();
                };
            };
            const notify = () => {
                if (!pendingRef.current) {
                    completionRef.current?.();
                }
            };
            return (
                <>
                    <PluginText
                        {...props}
                        data={{text: props.data.text as string}}
                        apiHandler={({text}) => {
                            if (text === 'markdown') {
                                return initial.promise;
                            }
                            return text === 'obsolete' ? obsolete.promise : latest.promise;
                        }}
                        onBeforeLoad={handleBeforeLoad}
                        onBeforeRender={() => () => {}}
                    />
                    <button onClick={notify}>Post-process</button>
                    <button onClick={notify}>Style changed</button>
                </>
            );
        }
        const registerManager = new RegisterManager();
        registerManager.registerPlugin({
            type: 'wrapped-text',
            renderer: (props) => <TextWrapper {...props} />,
        });
        const item: ConfigItem = {
            id: 'async',
            type: 'wrapped-text',
            namespace: 'default',
            data: {text: 'markdown'},
        };
        const context = createContext(item, registerManager);
        const ready = jest.fn(() => expect(document.body.textContent).toContain('committed'));
        const adjustWidgetLayout = jest.fn();
        const fixture = (current: ConfigItem) => (
            <DashKitContext.Provider value={context}>
                <Item
                    id={current.id}
                    item={current}
                    layout={context.layout}
                    shouldItemUpdate
                    adjustWidgetLayout={adjustWidgetLayout}
                    onItemRender={ready}
                />
            </DashKitContext.Provider>
        );
        const view = render(fixture(item));
        expect(ready).not.toHaveBeenCalled();
        await act(async () => initial.resolve({result: '<p>committed markdown</p>'}));
        expect(ready).toHaveBeenCalledTimes(1);
        expect(ready).toHaveBeenLastCalledWith(item);
        fireEvent.click(view.getByText('Post-process'));
        expect(ready).toHaveBeenCalledTimes(2);
        fireEvent.click(view.getByText('Style changed'));
        expect(ready).toHaveBeenCalledTimes(3);

        view.rerender(fixture({...item, data: {text: 'obsolete'}}));
        fireEvent.click(view.getByText('Style changed'));
        expect(ready).toHaveBeenCalledTimes(3);
        const current = {...item, data: {text: 'latest'}};
        view.rerender(fixture(current));
        fireEvent.click(view.getByText('Post-process'));
        expect(ready).toHaveBeenCalledTimes(3);
        await act(async () => latest.resolve({result: '<p>committed latest</p>'}));
        expect(ready).toHaveBeenCalledTimes(4);
        expect(ready).toHaveBeenLastCalledWith(current);
        fireEvent.click(view.getByText('Post-process'));
        expect(ready).toHaveBeenCalledTimes(5);
        fireEvent.click(view.getByText('Style changed'));
        expect(ready).toHaveBeenCalledTimes(6);
        await act(async () => {
            if (outcome === 'success') {
                obsolete.resolve({result: '<p>obsolete content</p>'});
            } else {
                obsolete.reject(new Error('obsolete request'));
            }
        });
        expect(view.getByText('committed latest')).toBeTruthy();
        expect(view.queryByText('obsolete content')).toBeNull();
        expect(ready).toHaveBeenCalledTimes(6);
        fireEvent.click(view.getByText('Style changed'));
        expect(ready).toHaveBeenCalledTimes(7);
        expect(ready).toHaveBeenLastCalledWith(current);
        view.unmount();
        act(() => retainedCompletion());
        expect(ready).toHaveBeenCalledTimes(7);
    },
);
