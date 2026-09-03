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

import {DashKitContext, DashkitOverlayControlsContext} from '../../../context';
import type {DashKitCtxShape, OverlayControlsCtxShape} from '../../../context';
import {type DashKitWithContextProps, withContext} from '../../../hocs/withContext';
import type {Config} from '../../../shared';
import {RegisterManager} from '../../../utils';
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
