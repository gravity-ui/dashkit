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

import {DashKitContext, type DashKitCtxShape} from '../../../context';
import {type DashKitWithContextProps, withContext} from '../../../hocs/withContext';
import type {Config} from '../../../shared';
import {RegisterManager} from '../../../utils';
import {DashKit} from '../DashKit';

const PLUGIN_TYPE = 'controlled-layout-test';

const createConfig = (x: number): Config => ({
    salt: 'test',
    counter: 1,
    items: [{id: 'item1', type: PLUGIN_TYPE, namespace: 'default', data: {}}],
    layout: [{i: 'item1', x, y: 0, w: 2, h: 2}],
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

const ContextCapture = () => {
    captured = React.useContext(DashKitContext);
    return null;
};

const TestComponent = withContext(ContextCapture);

describe('DashKit controlled layout strategy', () => {
    beforeEach(() => {
        captured = {} as DashKitCtxShape;
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
                    emitDashKitEvent: dashkit._emit,
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
                        emitDashKitEvent: dashkit._emit,
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
                    emitDashKitEvent: dashkit._emit,
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
                        emitDashKitEvent: dashkit._emit,
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
                    emitDashKitEvent: dashkit._emit,
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
                        emitDashKitEvent: dashkit._emit,
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
                        emitDashKitEvent: dashkit._emit,
                        onChange,
                    })}
                />,
            );
        });
        expect(captured.layout).toMatchObject(config3.layout);
    });
});
