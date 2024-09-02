import type {Config, ConfigItem, ConfigLayout} from '../shared';

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
    items: ConfigItem[];
    layout: ConfigLayout[];
}

export type ReactGridLayoutProps = Omit<
    ReactGridLayout.ReactGridLayoutProps,
    | 'children'
    | 'compactType'
    | 'innerRef'
    | 'key'
    | 'layout'
    | 'isDraggable'
    | 'isResizable'
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
