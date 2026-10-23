import isEqual from 'lodash/isEqual';

import type {Config} from '../shared';
import type {
    DashKitChangeEvent,
    DashKitEventMap,
    DashKitEventName,
    DashKitLayoutPatch,
} from '../typings';

import {convertEnrichedLayoutToConfigLayout} from './enrichLayoutWithDefaults';
import {getLayoutPatches} from './get-layout-patches';

// Only fires when layout changes; other config mutations (item ordering, counter) do not trigger this event.
export function emitDashKitChangeEvent({
    config,
    newConfig,
    onChange,
    emitDashKitEvent,
}: {
    config: Config;
    newConfig: Config;
    onChange: (data: {config: Config}) => void;
    emitDashKitEvent: <T extends DashKitEventName>(eventName: T, event: DashKitEventMap[T]) => void;
}) {
    if (
        !isEqual(
            convertEnrichedLayoutToConfigLayout(newConfig.layout),
            convertEnrichedLayoutToConfigLayout(config.layout),
        ) ||
        !isEqual(newConfig.containers, config.containers)
    ) {
        let defaultPrevented = false;
        let cachedPatches: DashKitLayoutPatch[] | undefined;
        const event: DashKitChangeEvent = {
            get patches() {
                if (!cachedPatches) {
                    cachedPatches = getLayoutPatches(config.layout, newConfig.layout);
                }
                return cachedPatches;
            },
            layout: newConfig.layout,
            previousLayout: config.layout,
            preventDefault() {
                defaultPrevented = true;
            },
            get defaultPrevented() {
                return defaultPrevented;
            },
        };
        // Keep getters on the event: downlevel object spread would copy their current values.
        if (newConfig.containers || config.containers) {
            event.containers = newConfig.containers;
            event.previousContainers = config.containers;
        }
        emitDashKitEvent('change', event);

        if (!defaultPrevented) {
            onChange({config: newConfig});
        }
    }
}
