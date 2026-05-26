import type {ConfigLayout} from '../shared';

/**
 * @experimental This API can change in minor releases.
 */
export type DashKitLayoutPatch = Pick<ConfigLayout, 'i'> &
    Partial<Pick<ConfigLayout, 'x' | 'y' | 'w' | 'h' | 'parent'>>;

/**
 * @experimental This API can change in minor releases.
 */
export type DashKitBaseEvent = {
    preventDefault: () => void;
    readonly defaultPrevented: boolean;
};

/**
 * @experimental This API can change in minor releases.
 */
export type DashKitChangeEvent = DashKitBaseEvent & {
    patches: DashKitLayoutPatch[];
    layout: ConfigLayout[];
    previousLayout: ConfigLayout[];
};

/**
 * @experimental This API can change in minor releases.
 */
export type DashKitEventMap = {
    change: DashKitChangeEvent;
};

/**
 * @experimental This API can change in minor releases.
 */
export type DashKitEventName = keyof DashKitEventMap;

/**
 * @experimental This API can change in minor releases.
 */
export type DashKitEventHandler<T extends DashKitEventName> = (event: DashKitEventMap[T]) => void;
