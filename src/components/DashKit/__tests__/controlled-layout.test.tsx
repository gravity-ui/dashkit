/**
 * @jest-environment jsdom
 */

jest.mock('@gravity-ui/icons', () => ({
    Ellipsis: 'ellipsis',
    Gear: 'gear',
    Xmark: 'xmark',
}));

jest.mock('@gravity-ui/uikit', () => {
    const ReactMock = require('react');

    return {
        Button: ({children}: {children?: unknown}) =>
            ReactMock.createElement('button', null, children),
        DropdownMenu: () => null,
        Icon: () => null,
    };
});

jest.mock('../../GridLayout/GridLayout', () => {
    const ReactMock = require('react');

    return ReactMock.forwardRef(() => null);
});

import React from 'react';

import {act, render} from '@testing-library/react';

import {TEMPORARY_ITEM_ID} from '../../../constants/common';
import {DashKitContext, DashKitDnDContext, DashkitOverlayControlsContext} from '../../../context';
import type {DashKitCtxShape, OverlayControlsCtxShape} from '../../../context';
import {type DashKitWithContextProps, withContext} from '../../../hocs/withContext';
import type {Config, ItemDropProps} from '../../../shared';
import {RegisterManager} from '../../../utils';
import {gridStackLayoutAdapter} from '../../GridStack/layout-adapter';
import {DashKit, _emitSymbol} from '../DashKit';

const PLUGIN_TYPE = 'controlled-layout-test';

const createConfig = (x: number, itemIds = ['item1']): Config => ({
    salt: 'test',
    counter: 1,
    items: itemIds.map((id) => ({id, type: PLUGIN_TYPE, namespace: 'default', data: {}})),
    layout: itemIds.map((i) => ({i, x, y: 0, w: 2, h: 2})),
    aliases: {},
    connections: [],
});

const createProps = ({
    config,
    emitDashKitEvent,
    onChange = jest.fn(),
}: {
    config: Config;
    emitDashKitEvent: DashKitWithContextProps['emitDashKitEvent'];
    onChange?: jest.Mock;
}) => {
    const registerManager = new RegisterManager();
    registerManager.registerPlugin({
        type: PLUGIN_TYPE,
        defaultLayout: {x: 0, y: 0, w: 2, h: 2},
        renderer: () => null,
    });

    return {
        config,
        editMode: true,
        layout: config.layout,
        registerManager,
        forwardedMetaRef: React.createRef(),
        emitDashKitEvent,
        itemsStateAndParams: {},
        defaultGlobalParams: {},
        globalParams: {},
        context: {},
        settings: {
            autoupdateInterval: 0,
            silentLoading: false,
        },
        noOverlay: false,
        focusable: false,
        onItemEdit: jest.fn(),
        onChange,
        onDrop: jest.fn(),
    };
};

let captured: DashKitCtxShape = {} as DashKitCtxShape;
let capturedControlsContext: OverlayControlsCtxShape | undefined;
let renderedItemIds: Array<{config: string[]; layout: string[]}> = [];
let layoutEffectAction:
    | ((
          dashkitContext: DashKitCtxShape,
          controlsContext: OverlayControlsCtxShape | undefined,
      ) => void)
    | undefined;

const ContextCapture = () => {
    const dashkitContext = React.useContext(DashKitContext);
    const controlsContext = React.useContext(DashkitOverlayControlsContext);

    captured = dashkitContext;
    capturedControlsContext = controlsContext || undefined;
    renderedItemIds.push({
        config: captured.configItems.map(({id}) => id),
        layout: captured.layout.map(({i}) => i),
    });

    React.useLayoutEffect(() => {
        layoutEffectAction?.(dashkitContext, controlsContext || undefined);
    }, [controlsContext, dashkitContext]);

    return null;
};

const TestComponent = withContext(ContextCapture);

describe('DashKit controlled layout strategy', () => {
    beforeEach(() => {
        captured = {} as DashKitCtxShape;
        capturedControlsContext = undefined;
        renderedItemIds = [];
        layoutEffectAction = undefined;
    });

    it('updates visual layout in same render as externally added config item', () => {
        const initialConfig = createConfig(0);
        const externalConfig = createConfig(3, ['item1', 'item2']);
        const dashkit = new DashKit(
            DashKit.defaultProps as unknown as ConstructorParameters<typeof DashKit>[0],
        );

        const {rerender} = render(
            <TestComponent
                {...createProps({config: initialConfig, emitDashKitEvent: dashkit[_emitSymbol]})}
            />,
        );

        act(() => {
            rerender(
                <TestComponent
                    {...createProps({
                        config: externalConfig,
                        emitDashKitEvent: dashkit[_emitSymbol],
                    })}
                />,
            );
        });

        expect(renderedItemIds).toEqual(
            expect.arrayContaining([
                {config: ['item1'], layout: ['item1']},
                {config: ['item1', 'item2'], layout: ['item1', 'item2']},
            ]),
        );
        expect(
            renderedItemIds.every(({config, layout}) => config.join(',') === layout.join(',')),
        ).toBe(true);
    });

    it('uses external baseline in child layout effect', () => {
        const initialConfig = createConfig(0);
        const externalConfig = createConfig(3, ['item1', 'item2']);
        const nextLayout: Config['layout'] = [
            {i: 'item1', x: 4, y: 0, w: 2, h: 2},
            externalConfig.layout[1],
        ];
        const dashkit = new DashKit(
            DashKit.defaultProps as unknown as ConstructorParameters<typeof DashKit>[0],
        );
        const onEventChange = jest.fn();
        let layoutItemInLayoutEffect: Config['layout'][number] | undefined;
        let layoutItemAfterLayoutChange: Config['layout'][number] | undefined;

        dashkit.on('change', onEventChange);

        const {rerender} = render(
            <TestComponent
                {...createProps({config: initialConfig, emitDashKitEvent: dashkit[_emitSymbol]})}
            />,
        );

        layoutEffectAction = (dashkitContext, controlsContext) => {
            layoutEffectAction = undefined;
            layoutItemInLayoutEffect = controlsContext?.getLayoutItem('item2') || undefined;
            dashkitContext.layoutChange(nextLayout);
            layoutItemAfterLayoutChange = controlsContext?.getLayoutItem('item1') || undefined;
        };

        act(() => {
            rerender(
                <TestComponent
                    {...createProps({
                        config: externalConfig,
                        emitDashKitEvent: dashkit[_emitSymbol],
                    })}
                />,
            );
        });

        expect(layoutItemInLayoutEffect).toMatchObject(externalConfig.layout[1]);
        expect(onEventChange).toHaveBeenCalledTimes(1);
        expect(onEventChange.mock.calls[0][0].previousLayout).toMatchObject(externalConfig.layout);
        expect(layoutItemAfterLayoutChange).toMatchObject(nextLayout[0]);
        expect(capturedControlsContext?.getLayoutItem('item1')).toMatchObject(nextLayout[0]);
    });

    it('Case 1: keeps internal layout after change event without config update, then applies external config update', () => {
        const initialConfig = createConfig(0);
        const nextInternalLayout: Config['layout'] = [{i: 'item1', x: 1, y: 0, w: 2, h: 2}];
        const externalConfig = createConfig(3);
        const dashkit = new DashKit(
            DashKit.defaultProps as unknown as ConstructorParameters<typeof DashKit>[0],
        );
        const onChange = jest.fn();
        const onEventChange = jest.fn();

        dashkit.on('change', onEventChange);

        const {rerender} = render(
            <TestComponent
                {...createProps({
                    config: initialConfig,
                    emitDashKitEvent: dashkit[_emitSymbol],
                    onChange,
                })}
            />,
        );

        // Layout is now enriched with plugin defaults (minW, minH, etc)
        expect(captured.layout).toMatchObject(initialConfig.layout);
        expect(captured.layout[0]).toHaveProperty('minW');
        expect(captured.layout[0]).toHaveProperty('minH');

        act(() => {
            captured.layoutChange(nextInternalLayout);
        });

        // Verify that change event was fired with correct layout
        expect(onEventChange).toHaveBeenCalledTimes(1);
        expect(onEventChange.mock.calls[0][0].layout).toEqual(nextInternalLayout);
        expect(onChange).toHaveBeenCalledTimes(1);

        // Now apply external config update
        act(() => {
            rerender(
                <TestComponent
                    {...createProps({
                        config: externalConfig,
                        emitDashKitEvent: dashkit[_emitSymbol],
                        onChange,
                    })}
                />,
            );
        });

        // External props should win and layout should be updated
        expect(captured.layout).toMatchObject(externalConfig.layout);
    });

    it('Case 2: uses on(change) without updating props - internal state persists', () => {
        const initialConfig = createConfig(0);
        const nextInternalLayout: Config['layout'] = [{i: 'item1', x: 5, y: 0, w: 2, h: 2}];
        const dashkit = new DashKit(
            DashKit.defaultProps as unknown as ConstructorParameters<typeof DashKit>[0],
        );
        const onChange = jest.fn();
        const onEventChange = jest.fn();
        const capturedLayouts: Config['layout'][] = [];

        // Listen to change event but DON'T update props
        dashkit.on('change', (event) => {
            capturedLayouts.push(event.layout);
            onEventChange(event);
        });

        const {rerender} = render(
            <TestComponent
                {...createProps({
                    config: initialConfig,
                    emitDashKitEvent: dashkit[_emitSymbol],
                    onChange,
                })}
            />,
        );

        // Initial layout should be enriched
        expect(captured.layout).toMatchObject(initialConfig.layout);

        // Trigger layout change
        act(() => {
            captured.layoutChange(nextInternalLayout);
        });

        // Event should fire with new layout
        expect(onEventChange).toHaveBeenCalledTimes(1);
        expect(capturedLayouts[0]).toEqual(nextInternalLayout);

        // onChange callback fires (consumer COULD update props here, but doesn't in this case)
        expect(onChange).toHaveBeenCalledTimes(1);

        // Props remain unchanged - simulating consumer NOT updating props
        act(() => {
            rerender(
                <TestComponent
                    {...createProps({
                        config: initialConfig,
                        emitDashKitEvent: dashkit[_emitSymbol],
                        onChange,
                    })}
                />,
            );
        });

        // Layout should still reflect the change (internal state wins)
        // Note: we verify the event fired correctly
        expect(onEventChange).toHaveBeenCalledTimes(1);
        expect(capturedLayouts[0]).toMatchObject(nextInternalLayout);
    });

    it('Case 3: alternates between props.layout updates and on(change) events', () => {
        const config1 = createConfig(0);
        const config2 = createConfig(2);
        const internalChange: Config['layout'] = [{i: 'item1', x: 5, y: 0, w: 2, h: 2}];
        const config3 = createConfig(8);

        const dashkit = new DashKit(
            DashKit.defaultProps as unknown as ConstructorParameters<typeof DashKit>[0],
        );
        const onChange = jest.fn();
        const onEventChange = jest.fn();

        dashkit.on('change', onEventChange);

        const {rerender} = render(
            <TestComponent
                {...createProps({
                    config: config1,
                    emitDashKitEvent: dashkit[_emitSymbol],
                    onChange,
                })}
            />,
        );

        // Start with config1
        expect(captured.layout).toMatchObject(config1.layout);

        // Update via props (external update)
        act(() => {
            rerender(
                <TestComponent
                    {...createProps({
                        config: config2,
                        emitDashKitEvent: dashkit[_emitSymbol],
                        onChange,
                    })}
                />,
            );
        });
        expect(captured.layout).toMatchObject(config2.layout);

        // Update via internal change (user drag)
        act(() => {
            captured.layoutChange(internalChange);
        });
        expect(onEventChange).toHaveBeenCalledTimes(1);
        expect(onEventChange.mock.calls[0][0].layout).toEqual(internalChange);

        // Update via props again (external update wins)
        act(() => {
            rerender(
                <TestComponent
                    {...createProps({
                        config: config3,
                        emitDashKitEvent: dashkit[_emitSymbol],
                        onChange,
                    })}
                />,
            );
        });
        expect(captured.layout).toMatchObject(config3.layout);
    });
});

// Critical: yes. Matching geometry must not hide changed plugin or explicit constraints.
describe.each([
    ['legacy', TestComponent],
    ['gridstack', withContext(ContextCapture, gridStackLayoutAdapter)],
] as const)('%s controlled constraints after a saved edit', (_engine, Component) => {
    it.each(['plugin', 'explicit'] as const)('applies changed %s constraints', (source) => {
        const onChange = jest.fn();
        const props = createProps({config: createConfig(0), emitDashKitEvent: jest.fn(), onChange});
        props.registerManager.reloadPlugin({
            type: PLUGIN_TYPE,
            defaultLayout: {w: 2, h: 2, minW: 1, minH: 1},
            renderer: () => null,
        });
        const view = render(<Component {...props} />);
        act(() => captured.layoutChange([{i: 'item1', x: 1, y: 0, w: 2, h: 2}]));
        const savedConfig: Config = onChange.mock.calls[0][0].config;
        const external = JSON.parse(JSON.stringify(savedConfig)) as Config;
        if (source === 'plugin') {
            props.registerManager.reloadPlugin({
                type: PLUGIN_TYPE,
                defaultLayout: {w: 2, h: 2, minW: 2, minH: 2},
                renderer: () => null,
            });
        } else {
            external.layout = external.layout.map((item) => ({...item, minW: 2, minH: 2}));
        }
        view.rerender(<Component {...props} config={external} />);
        expect(captured.layout).toEqual([{i: 'item1', x: 1, y: 0, w: 2, h: 2, minW: 2, minH: 2}]);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(savedConfig.layout).toEqual([{i: 'item1', x: 1, y: 0, w: 2, h: 2}]);
    });
});

// Critical: yes. Empty legacy containers must not turn a saved edit into a nested dashboard.
describe.each([
    ['legacy', TestComponent],
    ['gridstack', withContext(ContextCapture, gridStackLayoutAdapter)],
] as const)('%s optional containers layout version', (_engine, Component) => {
    const nestedContainers: NonNullable<Config['containers']> = [
        {
            id: 'box',
            x: 4,
            y: 0,
            w: 4,
            h: 4,
            padding: [0, 0, 0, 0],
            gap: [0, 0],
            grid: {cols: 4, rowHeight: 10, compactType: null},
        },
    ];
    it.each<{
        name: string;
        containers?: Config['containers'];
        version?: 2;
        expectedVersion?: 2;
    }>([
        {name: 'absent', containers: undefined, version: undefined},
        {name: 'empty legacy', containers: [], version: undefined},
        {name: 'empty nested', containers: [], version: 2, expectedVersion: 2},
        {name: 'versioned without containers', version: 2, expectedVersion: 2},
        {name: 'nonempty nested', containers: nestedContainers, expectedVersion: 2},
    ])('preserves $name after layoutChange', ({containers, version, expectedVersion}) => {
        const onChange = jest.fn();
        const config: Config = {
            ...createConfig(0),
            ...(containers === undefined ? {} : {containers}),
            ...(version === 2 ? {layoutVersion: version} : {}),
        };
        const props = createProps({config, emitDashKitEvent: jest.fn(), onChange});
        const view = render(<Component {...props} />);

        act(() => captured.layoutChange([{...config.layout[0], x: 1}]));

        const savedConfig: Config = onChange.mock.calls[0][0].config;
        expect(savedConfig.containers).toEqual(containers);
        expect('containers' in savedConfig).toBe(containers !== undefined);
        expect(savedConfig.layout).toEqual([{...config.layout[0], x: 1}]);
        if (expectedVersion === undefined) {
            expect(() =>
                new DashKit({
                    ...DashKit.defaultProps,
                    config: savedConfig,
                } as ConstructorParameters<typeof DashKit>[0]).render(),
            ).not.toThrow();
        }
        expect(savedConfig.layoutVersion).toBe(expectedVersion);
        act(() => captured.onItemStateAndParamsChange('item1', {state: {clicked: true}}));
        expect(onChange.mock.calls[1][0].config.layoutVersion).toBe(expectedVersion);
        expect(onChange.mock.calls[1][0].config.containers).toEqual(containers);
        view.unmount();
    });

    it.each([undefined, 2] as const)(
        'retains an emptied container baseline before acknowledgment, initial version %s',
        (layoutVersion) => {
            const onChange = jest.fn();
            const config: Config = {
                ...createConfig(0),
                containers: nestedContainers,
                layoutVersion,
            };
            const props = createProps({config, emitDashKitEvent: jest.fn(), onChange});
            const view = render(<Component {...props} />);

            act(() => captured.layoutChange([{...config.layout[0], x: 1}], []));
            act(() => captured.layoutChange([{...config.layout[0], x: 2}]));
            act(() => captured.onItemStateAndParamsChange('item1', {state: {clicked: true}}));

            expect(onChange).toHaveBeenCalledTimes(3);
            for (const [change] of onChange.mock.calls) {
                expect(change.config.containers).toEqual([]);
                expect(change.config.layoutVersion).toBe(2);
            }
            expect(onChange.mock.calls[2][0].config.layout).toEqual([{...config.layout[0], x: 2}]);
            view.unmount();
        },
    );
});

// Critical: yes. Apply must render saved container geometry under supported StrictMode roots.
describe.each([
    ['legacy', TestComponent],
    ['gridstack', withContext(ContextCapture, gridStackLayoutAdapter)],
] as const)('%s StrictMode controlled containers', (_engine, Component) => {
    const containers: NonNullable<Config['containers']> = [
        {
            id: 'box',
            x: 0,
            y: 0,
            w: 4,
            h: 4,
            padding: [0, 0, 0, 0],
            gap: [0, 0],
            grid: {cols: 4, rowHeight: 10, compactType: null},
        },
        {
            id: 'inside',
            containerId: 'box',
            x: 0,
            y: 0,
            w: 4,
            h: 4,
            padding: [0, 0, 0, 0],
            gap: [0, 0],
            grid: {cols: 4, rowHeight: 10, compactType: null},
        },
    ];
    const config: Config = {
        ...createConfig(0),
        layoutVersion: 2,
        layout: [{...createConfig(0).layout[0], containerId: 'inside'}],
        containers,
    };
    beforeEach(() => {
        layoutEffectAction = undefined;
    });

    it('applies an external container revision before the next edit', () => {
        const onChange = jest.fn();
        const props = createProps({config, emitDashKitEvent: jest.fn(), onChange});
        const view = render(
            <React.StrictMode>
                <Component {...props} />
            </React.StrictMode>,
        );
        const external: Config = {
            ...config,
            containers: containers.map((container) => ({
                ...container,
                y: container.id === 'box' ? 2 : 0,
            })),
        };

        view.rerender(
            <React.StrictMode>
                <Component {...props} config={external} />
            </React.StrictMode>,
        );

        expect(captured.config.containers).toEqual(external.containers);
        expect(captured.containers).toEqual(external.containers);
        expect(captured.externalLayoutRevision).toBe(1);
        expect(onChange).not.toHaveBeenCalled();
        act(() => captured.layoutChange([{...config.layout[0], x: 1}]));
        const saved: Config = onChange.mock.calls[0][0].config;
        expect(saved.containers).toEqual(external.containers);
        view.rerender(
            <React.StrictMode>
                <Component {...props} config={saved} />
            </React.StrictMode>,
        );
        expect(captured.containers).toEqual(saved.containers);
        expect(captured.layout[0].x).toBe(1);
        expect(captured.externalLayoutRevision).toBe(1);
        view.unmount();
    });

    it('uses the latest external baseline from a callback retained by a child effect', () => {
        const onChange = jest.fn();
        const props = createProps({config, emitDashKitEvent: jest.fn(), onChange});
        const fixture = (document: Config) => (
            <React.StrictMode>
                <Component {...props} config={document} />
            </React.StrictMode>
        );
        const view = render(fixture(config));
        let retainedChange = captured.onItemStateAndParamsChange;
        layoutEffectAction = (context) => {
            layoutEffectAction = undefined;
            retainedChange = context.onItemStateAndParamsChange;
        };
        view.rerender(
            fixture({
                ...config,
                containers: containers.map((box) => ({...box, x: box.id === 'box' ? 1 : 0})),
            }),
        );
        const latest = {
            ...config,
            containers: containers.map((box) => ({...box, x: box.id === 'box' ? 2 : 0})),
        };
        view.rerender(fixture(latest));

        act(() => retainedChange('item1', {state: {clicked: true}}));
        expect(onChange.mock.calls[0][0].config.containers).toEqual(latest.containers);
        view.unmount();
    });

    it('retains the newest child-effect container edit through the parent commit', () => {
        const onChange = jest.fn();
        const props = createProps({config, emitDashKitEvent: jest.fn(), onChange});
        const fixture = (document: Config) => (
            <React.StrictMode>
                <Component {...props} config={document} />
            </React.StrictMode>
        );
        const view = render(fixture(config));
        const external: Config = {
            ...config,
            containers: containers.map((container) => ({
                ...container,
                y: container.id === 'box' ? 2 : 0,
            })),
        };
        let observedContainers: Config['containers'];
        layoutEffectAction = (context) => {
            layoutEffectAction = undefined;
            observedContainers = context.containers;
            context.layoutChange([{...config.layout[0], x: 1}]);
            // Reusing the original array is still a newer committed edit.
            context.layoutChange([{...config.layout[0], x: 2}], config.containers);
        };

        view.rerender(fixture(external));
        expect(observedContainers).toEqual(external.containers);
        expect(onChange.mock.calls[0][0].config.containers).toEqual(external.containers);
        act(() => captured.onItemStateAndParamsChange('item1', {state: {clicked: true}}));
        expect(onChange.mock.calls[2][0].config).toMatchObject({
            layout: [{...config.layout[0], x: 2}],
            containers: config.containers,
        });
        view.unmount();
    });

    it.each(['cancel', 'apply'] as const)(
        'restores the controlled baseline after pending drop %s',
        (action) => {
            const props = createProps({config, emitDashKitEvent: jest.fn()});
            const onDrop = jest.fn();
            const dragContext = {
                dragProps: {type: PLUGIN_TYPE},
                dragImagePreview: null,
                onDragStart: jest.fn(),
                onDragEnd: jest.fn(),
            };
            const fixture = (document: Config) => (
                <React.StrictMode>
                    <DashKitDnDContext.Provider value={dragContext}>
                        <Component {...props} config={document} onDrop={onDrop} />
                    </DashKitDnDContext.Provider>
                </React.StrictMode>
            );
            const view = render(fixture(config));
            const pendingContainers = containers.map((container) => ({
                ...container,
                y: container.id === 'box' ? 2 : 0,
            }));
            act(() =>
                captured.onDrop(
                    config.layout,
                    {i: TEMPORARY_ITEM_ID, x: 4, y: 0, w: 2, h: 2},
                    undefined,
                    pendingContainers,
                ),
            );
            expect(captured.containers).toEqual(pendingContainers);
            expect(captured.config.containers).toEqual(config.containers);
            expect(props.onChange).not.toHaveBeenCalled();
            const drop: ItemDropProps = onDrop.mock.calls[0][0];
            if (action === 'apply') {
                view.rerender(
                    fixture({
                        ...config,
                        containers: drop.containers,
                        items: [...config.items, {...config.items[0], id: 'item2'}],
                        layout: [...drop.newLayout, {...drop.itemLayout, i: 'item2'}],
                    }),
                );
                expect(captured.configItems.map(({id}) => id)).toEqual(['item1', 'item2']);
            }
            act(() => drop.commit());
            expect(captured.temporaryLayout).toBeNull();
            expect(captured.containers).toEqual(
                action === 'apply' ? pendingContainers : config.containers,
            );
            expect(props.onChange).not.toHaveBeenCalled();
            view.unmount();
        },
    );
});
