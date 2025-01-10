import React from 'react';

import type {DashKitProps} from '../components';
import type {ConfigLayout, ItemParams, ItemState} from '../shared';
import type {MenuItem} from '../typings';

export type OverlayControlsCtxShape = Pick<
    DashKitProps,
    | 'context'
    | 'overlayControls'
    | 'itemsStateAndParams'
    | 'getPreparedCopyItemOptions'
    | 'onCopyFulfill'
> & {
    menu: DashKitProps['overlayMenuItems'] | MenuItem[];
    itemsState?: Record<string, ItemState>;
    itemsParams: Record<string, ItemParams>;

    editItem: DashKitProps['onItemEdit'];
    removeItem: (id: string) => void;
    getLayoutItem: (id: string) => ConfigLayout | void;
};

export const DashkitOvelayControlsContext = React.createContext<OverlayControlsCtxShape | void>(
    undefined,
);
