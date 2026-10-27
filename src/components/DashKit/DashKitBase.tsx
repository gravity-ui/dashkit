import React from 'react';

import noop from 'lodash/noop';

import {DashKitDnDContext} from '../../context';
import type {
    Config,
    ConfigItem,
    GlobalParams,
    ItemDropProps,
    ItemsStateAndParams,
} from '../../shared';
import type {
    ContextProps,
    DashKitEventHandler,
    DashKitEventMap,
    DashKitEventName,
    DashKitGroup,
    ItemManipulationCallback,
    MenuItem,
    Plugin,
    Settings,
    SettingsProps,
} from '../../typings';
import type {OverlayControlItem, PreparedCopyItemOptions} from '../OverlayControls/OverlayControls';

import {registerManager} from './registration';

interface DashKitGeneralProps {
    config: Config;
    editMode: boolean;
    draggableHandleClassName?: string;
    overlayControls?: Record<string, OverlayControlItem[]> | null;
    overlayMenuItems?: MenuItem[] | null;
}

interface DashKitDefaultProps {
    defaultGlobalParams: GlobalParams;
    globalParams: GlobalParams;
    itemsStateAndParams: ItemsStateAndParams;
    settings: SettingsProps;
    context: ContextProps;
    noOverlay: boolean;
    focusable?: boolean;
    groups?: DashKitGroup[];

    onItemEdit: (item: ConfigItem) => void;
    onChange: (data: {
        config: Config;
        itemsStateAndParams: ItemsStateAndParams;
        groups?: DashKitGroup[];
    }) => void;

    onDrop: (dropProps: ItemDropProps) => void;

    onItemMountChange?: (item: ConfigItem, state: {isAsync: boolean; isMounted: boolean}) => void;
    onItemRender?: (item: ConfigItem) => void;

    getPreparedCopyItemOptions?: (options: PreparedCopyItemOptions) => PreparedCopyItemOptions;
    onCopyFulfill?: (error: null | Error, data?: PreparedCopyItemOptions) => void;

    onItemFocus?: (item: ConfigItem) => void;
    onItemBlur?: (item: ConfigItem) => void;

    onDragStart?: ItemManipulationCallback;
    onDrag?: ItemManipulationCallback;
    onDragStop?: ItemManipulationCallback;
    onResizeStart?: ItemManipulationCallback;
    onResize?: ItemManipulationCallback;
    onResizeStop?: ItemManipulationCallback;
}

export interface DashKitProps extends DashKitGeneralProps, Partial<DashKitDefaultProps> {}

type DashKitInnerProps = DashKitGeneralProps & DashKitDefaultProps;

/**
 * @internal Exported for compatibility. Do not use in production code.
 */
export const _emitSymbol = Symbol('DashKit._emit');

export interface DashKitLayoutRef {
    getItemsMeta(): Array<Promise<any>>;
    reloadItems(options?: {targetIds?: string[]; force?: boolean}): void;
}

export abstract class DashKitBase<
    TLayout extends DashKitLayoutRef = DashKitLayoutRef,
> extends React.PureComponent<DashKitInnerProps> {
    static defaultProps: DashKitDefaultProps = {
        onItemEdit: noop,
        onChange: noop,
        onDrop: noop,
        defaultGlobalParams: {},
        globalParams: {},
        itemsStateAndParams: {},
        settings: {
            autoupdateInterval: 0,
            silentLoading: false,
        },
        context: {},
        noOverlay: false,
        focusable: false,
    };

    static contextType = DashKitDnDContext;

    static registerPlugins(...plugins: Plugin[]) {
        plugins.forEach((plugin) => {
            registerManager.registerPlugin(plugin);
        });
    }

    static reloadPlugins(...plugins: Plugin[]) {
        plugins.forEach((plugin) => {
            registerManager.reloadPlugin(plugin);
        });
    }

    static setSettings(settings: Settings) {
        registerManager.setSettings(settings);
    }

    metaRef = React.createRef<TLayout>();

    private _handlers = new Map<string, Set<(...args: any[]) => void>>();

    getItemsMeta() {
        return this.metaRef.current?.getItemsMeta() ?? [];
    }

    reloadItems(options?: {targetIds?: string[]; force?: boolean}) {
        this.metaRef.current?.reloadItems(options);
    }

    /**
     * @experimental This API can change in minor releases.
     * @param eventName Event name.
     * @param handler Event handler.
     * @returns Unsubscribe callback.
     */
    on<T extends DashKitEventName>(eventName: T, handler: DashKitEventHandler<T>): () => void {
        if (!this._handlers.has(eventName)) {
            this._handlers.set(eventName, new Set());
        }
        this._handlers.get(eventName)?.add(handler);
        return () => this._off(eventName, handler);
    }

    [_emitSymbol] = <T extends DashKitEventName>(eventName: T, event: DashKitEventMap[T]): void => {
        const handlers = this._handlers.get(eventName);
        if (!handlers) {
            return;
        }
        for (const handler of handlers) {
            try {
                (handler as DashKitEventHandler<T>)(event);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('DashKit: event handler error', e);
            }
        }
    };

    private _off<T extends DashKitEventName>(eventName: T, handler: DashKitEventHandler<T>): void {
        const handlers = this._handlers.get(eventName);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this._handlers.delete(eventName);
            }
        }
    }
}
