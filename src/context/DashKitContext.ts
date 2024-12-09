import React from 'react';

import type {RegisterManager} from '..//utils';
import type {DashKitProps} from '../components/DashKit';
import type {
    ConfigItem,
    ConfigLayout,
    ItemParams,
    ItemState,
    ItemStateAndParams,
    ItemStateAndParamsChangeOptions,
} from '../shared';

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

export type DashKitCtxShape = DashkitPropsPassedToCtx & {
    registerManager: RegisterManager;
    forwardedMetaRef: React.ForwardedRef<any>;

    layout: ConfigLayout[];
    temporaryLayout: ConfigLayout[] | null;
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

    getItemsMeta: (pluginsRefs: Array<React.RefObject<any>>) => Array<Promise<any>>;
    reloadItems: (
        pluginsRefs: Array<React.RefObject<any>>,
        data: {silentLoading: boolean; noVeil: boolean},
    ) => void;

    onDrop: (newLayout: ConfigLayout, item: ConfigItem) => void;
    onDropDragOver: (
        e: DragEvent | MouseEvent,
        group: string | void,
        gridProps: Partial<ReactGridLayout.ReactGridLayoutProps>,
        groupLayout: ConfigLayout[],
        sharedItem: (Partial<ConfigLayout> & {type: PluginType}) | void,
    ) => void | boolean;
    outerDnDEnable: boolean;
    dragOverPlugin: null | PluginType;
};

const DashKitContext = React.createContext<DashKitCtxShape>({} as DashKitCtxShape);

export {DashKitContext};
