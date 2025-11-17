import React from 'react';

import type {DragOverEvent} from 'react-grid-layout';

import type {RegisterManager, RegisterManagerPlugin} from '..//utils';
import type {DashKitProps} from '../components/DashKit';
import type {
    ConfigItem,
    ConfigLayout,
    DraggedOverItem,
    ItemDragProps,
    ItemParams,
    ItemState,
    ItemStateAndParams,
    ItemStateAndParamsChangeOptions,
} from '../shared';
import type {ContextProps, PluginRef, ReactGridLayoutProps, SettingsProps} from '../typings';

type DashkitPropsPassedToCtx = Pick<
    DashKitProps,
    | 'config'
    | 'groups'
    | 'context'
    | 'noOverlay'
    | 'focusable'
    | 'globalParams'
    | 'editMode'
    | 'settings'
    | 'onItemMountChange'
    | 'onItemRender'
    | 'draggableHandleClassName'
    // default handlers bypass
    | 'onDragStart'
    | 'onDrag'
    | 'onDragStop'
    | 'onResizeStart'
    | 'onResize'
    | 'onResizeStop'
>;

export type TemporaryLayout = {
    data: ConfigLayout[];
    dragProps: ItemDragProps;
};

export type DashKitCtxShape = Omit<DashkitPropsPassedToCtx, 'context' | 'settings'> & {
    context: ContextProps;
    settings: SettingsProps;

    registerManager: RegisterManager;
    forwardedMetaRef: React.ForwardedRef<any>;

    configItems: ConfigItem[];
    layout: ConfigLayout[];
    layoutChange: (layout: ConfigLayout[]) => void;
    temporaryLayout: TemporaryLayout | null;
    memorizeOriginalLayout: (
        widgetId: string,
        preAutoHeightLayout: ConfigLayout,
        postAutoHeightLayout: ConfigLayout,
    ) => void;
    revertToOriginalLayout: (widgetId: string) => void;

    itemsState: Record<string, ItemState>;
    itemsParams: Record<string, ItemParams>;
    onItemStateAndParamsChange: (
        id: string,
        stateAndParams: ItemStateAndParams,
        options?: ItemStateAndParamsChangeOptions,
    ) => void;

    getItemsMeta: (pluginsRefs: Array<PluginRef>) => Array<Promise<any>>;
    reloadItems: (
        pluginsRefs: Array<PluginRef>,
        data: {silentLoading: boolean; noVeil: boolean},
    ) => void;

    onDrop: (newLayout: ConfigLayout[], item: ConfigLayout, e?: MouseEvent) => void;
    onDropDragOver: (
        e: DragOverEvent,
        group: string | undefined,
        gridProps: ReactGridLayoutProps,
        groupLayout: ConfigLayout[],
        sharedItem?: DraggedOverItem,
    ) => {w?: number; h?: number} | false | undefined;
    onItemBlur?: (item: ConfigItem) => void;
    onItemFocus?: (item: ConfigItem) => void;
    outerDnDEnable: boolean;
    dragOverPlugin: null | RegisterManagerPlugin;
};

const DashKitContext = React.createContext<DashKitCtxShape>({} as DashKitCtxShape);

export {DashKitContext};
