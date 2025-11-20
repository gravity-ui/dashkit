import React from 'react';

import type {RegisterManager} from '..//utils';
import type {DashKitProps} from '../components/DashKit';
import type {
    ConfigItem,
    ConfigLayout,
    ItemDragProps,
    ItemParams,
    ItemState,
    ItemStateAndParams,
    ItemStateAndParamsChangeOptions,
} from '../shared';
import type {PluginRef, ReactGridLayoutProps} from '../typings';

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

type PluginType = string;

type TemporaryLayout = {
    data: ConfigLayout[];
    dragProps: ItemDragProps;
};

export type DashKitCtxShape = DashkitPropsPassedToCtx & {
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

    itemsState?: Record<string, ItemState>;
    itemsParams: Record<string, ItemParams>;
    onItemStateAndParamsChange: (
        id: string,
        stateAndParams: ItemStateAndParams,
        options: ItemStateAndParamsChangeOptions,
    ) => void;

    getItemsMeta: (pluginsRefs: Array<PluginRef>) => Array<Promise<any>>;
    reloadItems: (
        pluginsRefs: Array<PluginRef>,
        data: {silentLoading: boolean; noVeil: boolean},
    ) => void;

    onDrop: (newLayout: ConfigLayout[], item: ConfigLayout, e?: MouseEvent) => void;
    onDropDragOver: (
        e: DragEvent | MouseEvent,
        group: string | void,
        gridProps: ReactGridLayoutProps,
        groupLayout: ConfigLayout[],
        sharedItem: (Partial<ConfigLayout> & {type: PluginType}) | void,
    ) => {w?: number; h?: number} | false | undefined;
    onItemBlur: (item: ConfigItem) => void;
    onItemFocus: (item: ConfigItem) => void;
    outerDnDEnable: boolean;
    dragOverPlugin: null | PluginType;
};

const DashKitContext = React.createContext<DashKitCtxShape>({} as DashKitCtxShape);

export {DashKitContext};
