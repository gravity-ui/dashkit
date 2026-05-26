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

import {emitDashKitChangeEvent} from '../../../hocs/withContext';
import type {Config} from '../../../shared';
import type {DashKitEventMap, DashKitLayoutPatch} from '../../../typings';
import {DashKit} from '../../DashKit';

const TEST_CONFIG: Config = {
    salt: 'test',
    counter: 1,
    items: [{id: 'item1', type: 'test-event', namespace: 'default', data: {}}],
    layout: [{i: 'item1', x: 0, y: 0, w: 2, h: 2}],
    aliases: {},
    connections: [],
};

const NEXT_LAYOUT: Config['layout'] = [{i: 'item1', x: 1, y: 0, w: 2, h: 2}];
const NEXT_CONFIG: Config = {...TEST_CONFIG, layout: NEXT_LAYOUT};

describe('DashKit change event — onChange gate', () => {
    it('no handler: onChange fires with full config when layout changes', () => {
        const onChange = jest.fn();
        const emitDashKitEvent = jest.fn();

        emitDashKitChangeEvent({
            config: TEST_CONFIG,
            newConfig: NEXT_CONFIG,
            onChange,
            emitDashKitEvent,
        });

        expect(emitDashKitEvent).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].config.layout).toEqual(NEXT_LAYOUT);
    });

    it('handler without preventDefault: onChange fires and handler receives correct event', () => {
        const instance = new DashKit(DashKit.defaultProps as never);
        const onChange = jest.fn();
        const handler = jest.fn();

        instance.on('change', handler);

        emitDashKitChangeEvent({
            config: TEST_CONFIG,
            newConfig: NEXT_CONFIG,
            onChange,
            emitDashKitEvent: instance._emit,
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
        const event = handler.mock.calls[0][0] as DashKitEventMap['change'];
        expect(event.layout).toEqual(NEXT_LAYOUT);
        expect(event.previousLayout).toEqual(TEST_CONFIG.layout);
        expect(event.defaultPrevented).toBe(false);
    });

    it('handler calls preventDefault: onChange does NOT fire; event carries correct patches', () => {
        const instance = new DashKit(DashKit.defaultProps as never);
        const onChange = jest.fn();
        let capturedEvent: DashKitEventMap['change'] | undefined;

        instance.on('change', (e) => {
            capturedEvent = e;
            e.preventDefault();
        });

        emitDashKitChangeEvent({
            config: TEST_CONFIG,
            newConfig: NEXT_CONFIG,
            onChange,
            emitDashKitEvent: instance._emit,
        });

        expect(onChange).not.toHaveBeenCalled();
        expect(capturedEvent).toBeDefined();
        if (capturedEvent) {
            expect(capturedEvent.patches).toEqual([{i: 'item1', x: 1, y: 0, w: 2, h: 2}]);
            expect(capturedEvent.layout).toEqual(NEXT_LAYOUT);
            expect(capturedEvent.previousLayout).toEqual(TEST_CONFIG.layout);
            expect(capturedEvent.defaultPrevented).toBe(true);
        }
    });

    it('same layout: event and onChange do not fire', () => {
        const onChange = jest.fn();
        const emitDashKitEvent = jest.fn();

        emitDashKitChangeEvent({
            config: TEST_CONFIG,
            newConfig: TEST_CONFIG,
            onChange,
            emitDashKitEvent,
        });

        expect(emitDashKitEvent).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('DashKit event emitter', () => {
    it('unsubscribe stops handler from being called', () => {
        const instance = new DashKit(DashKit.defaultProps as never);
        const handler = jest.fn();

        const unsubscribe = instance.on('change', handler);
        unsubscribe();

        const event = {
            patches: [],
            layout: [],
            previousLayout: [],
            preventDefault: jest.fn(),
            defaultPrevented: false,
        } as unknown as DashKitEventMap['change'];

        instance._emit('change', event);

        expect(handler).not.toHaveBeenCalled();
    });

    it('handler error does not stop other handlers; onChange still fires', () => {
        const instance = new DashKit(DashKit.defaultProps as never);
        const onChange = jest.fn();
        const normalHandler = jest.fn();

        instance.on('change', () => {
            throw new Error('boom');
        });
        instance.on('change', normalHandler);

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        emitDashKitChangeEvent({
            config: TEST_CONFIG,
            newConfig: NEXT_CONFIG,
            onChange,
            emitDashKitEvent: instance._emit,
        });

        consoleErrorSpy.mockRestore();

        expect(normalHandler).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
    });
});

describe('DashKit change event — internal baseline (preventDefault flow)', () => {
    it('preventDefault flow: sequential changes produce incremental patches when baseline is updated', () => {
        const instance = new DashKit(DashKit.defaultProps as never);
        const onChange = jest.fn();
        const patches: Array<DashKitLayoutPatch[]> = [];

        instance.on('change', (e) => {
            patches.push([...e.patches]);
            e.preventDefault();
        });

        const config1: Config = {
            ...TEST_CONFIG,
            items: [
                {id: 'item1', type: 'test-event', namespace: 'default', data: {}},
                {id: 'item2', type: 'test-event', namespace: 'default', data: {}},
            ],
            layout: [
                {i: 'item1', x: 0, y: 0, w: 2, h: 2},
                {i: 'item2', x: 2, y: 0, w: 2, h: 2},
            ],
        };

        const config2: Config = {
            ...config1,
            layout: [
                {i: 'item1', x: 1, y: 0, w: 2, h: 2}, // item1 moved to x=1
                {i: 'item2', x: 2, y: 0, w: 2, h: 2}, // item2 unchanged
            ],
        };

        const config3: Config = {
            ...config1,
            layout: [
                {i: 'item1', x: 1, y: 0, w: 2, h: 2}, // item1 unchanged
                {i: 'item2', x: 3, y: 0, w: 2, h: 2}, // item2 moved to x=3
            ],
        };

        // First change: item1 moved from x=0 to x=1
        emitDashKitChangeEvent({
            config: config1,
            newConfig: config2,
            onChange,
            emitDashKitEvent: instance._emit,
        });

        // Second change: In withContext, the internal baseline is updated automatically
        // after each change. Here we simulate this behavior by passing config2 as baseline.
        emitDashKitChangeEvent({
            config: config2, // internal baseline updated to config2.layout
            newConfig: config3,
            onChange,
            emitDashKitEvent: instance._emit,
        });

        expect(onChange).not.toHaveBeenCalled(); // preventDefault works
        expect(patches).toHaveLength(2);

        // First patch: only item1
        expect(patches[0]).toEqual([{i: 'item1', x: 1, y: 0, w: 2, h: 2}]);

        // Second patch: only item2 (NO accumulation!)
        // This works because baseline was updated from config1.layout to config2.layout
        expect(patches[1]).toEqual([{i: 'item2', x: 3, y: 0, w: 2, h: 2}]);
    });

    it('legacy flow: onChange updates props and patches work correctly', () => {
        const instance = new DashKit(DashKit.defaultProps as never);
        let currentConfig: Config = {
            ...TEST_CONFIG,
            items: [
                {id: 'item1', type: 'test-event', namespace: 'default', data: {}},
                {id: 'item2', type: 'test-event', namespace: 'default', data: {}},
            ],
            layout: [
                {i: 'item1', x: 0, y: 0, w: 2, h: 2},
                {i: 'item2', x: 2, y: 0, w: 2, h: 2},
            ],
        };
        const patches: Array<Array<{i: string; x?: number; y?: number; w?: number; h?: number}>> =
            [];

        instance.on('change', (e) => {
            patches.push([...e.patches]);
            // NO preventDefault → onChange will fire
        });

        const onChange = jest.fn(({config}) => {
            currentConfig = config; // consumer updates state
        });

        const config2 = {
            ...currentConfig,
            layout: [
                {i: 'item1', x: 1, y: 0, w: 2, h: 2}, // item1 moved to x=1
                {i: 'item2', x: 2, y: 0, w: 2, h: 2}, // item2 unchanged
            ],
        };

        emitDashKitChangeEvent({
            config: currentConfig,
            newConfig: config2,
            onChange,
            emitDashKitEvent: instance._emit,
        });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(patches[0]).toEqual([{i: 'item1', x: 1, y: 0, w: 2, h: 2}]);

        // Second change with updated config
        const config3 = {
            ...currentConfig,
            layout: [
                {i: 'item1', x: 1, y: 0, w: 2, h: 2}, // item1 unchanged
                {i: 'item2', x: 3, y: 0, w: 2, h: 2}, // item2 moved to x=3
            ],
        };

        emitDashKitChangeEvent({
            config: currentConfig, // ← updated after first onChange
            newConfig: config3,
            onChange,
            emitDashKitEvent: instance._emit,
        });

        expect(onChange).toHaveBeenCalledTimes(2);
        expect(patches[1]).toEqual([{i: 'item2', x: 3, y: 0, w: 2, h: 2}]); // only new changes
    });
});
