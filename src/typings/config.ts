import type {Layout, Layouts} from 'react-grid-layout';

import type {Config, ConfigItem, ConfigLayout} from '../shared';

import {GridLayoutSettings} from './common';

export interface AddConfigItem extends Omit<ConfigItem, 'id' | 'namespace'> {
    id?: null;
    namespace?: string;
    layout?: Omit<ConfigLayout, 'i'>;
}
export type SetConfigItem = ConfigItem | AddConfigItem;

export type SetItemOptions = {
    excludeIds?: string[];
};

export type GridReflowOptions = {
    cols: number;
    maxRows?: number;
    compactType?: CompactType;
};

export type CompactType = ReactGridLayout.ReactGridLayoutProps['compactType'] | 'horizontal-nowrap';

export type ReflowLayoutOptions = {
    defaultProps: GridReflowOptions;
    groups?: Record<string, GridReflowOptions>;
};

export type AddNewItemOptions = SetItemOptions & {
    updateLayout?: ConfigLayout[];
    reflowLayoutOptions?: ReflowLayoutOptions;
};

export interface DashkitGroupRenderProps {
    config: Config;
    editMode: boolean;
    isDragging: boolean;
    isMobile: boolean;
    items: ConfigItem[];
    layout: ConfigLayout[];
    context: any;
}

export type ReactGridLayoutProps = Omit<
    GridLayoutSettings,
    | 'children'
    | 'compactType'
    | 'innerRef'
    | 'key'
    | 'layout'
    | 'onDragStart'
    | 'onDragStop'
    | 'onResizeStart'
    | 'onResizeStop'
    | 'draggableHandle'
    | 'isDroppable'
    | 'onDropDragOver'
    | 'onDrop'
    | 'draggableCancel'
> & {
    compactType?: CompactType;
};

export interface DashKitGroup {
    id?: string;
    render?: (
        id: string,
        children: React.ReactNode,
        props: DashkitGroupRenderProps,
    ) => React.ReactNode;
    gridProperties?: (props: ReactGridLayoutProps) => ReactGridLayoutProps;
}

export type ItemManipulationCallback = (eventData: {
    layout: Layouts;
    oldItem: Layout;
    newItem: Layout;
    placeholder: Layout;
    e: MouseEvent;
    element: HTMLElement;
}) => void;
