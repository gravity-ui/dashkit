import type {Config, ConfigItem, ConfigLayout} from '../shared';

export interface AddConfigItem extends Omit<ConfigItem, 'id' | 'namespace'> {
    id?: null;
    namespace?: string;
    layout?: ConfigLayout;
}
export type SetConfigItem = ConfigItem | AddConfigItem;

export type SetItemOptions = {
    excludeIds?: string[];
};

export type SetNewItemOptions = SetItemOptions & {
    updateLayout?: ConfigLayout[];
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
>;

export interface DashKitGroup {
    id?: string;
    render?: (
        id: string,
        children: React.ReactNode,
        props: DashkitGroupRenderProps,
    ) => React.ReactNode;
    gridProperties?: (props: ReactGridLayoutProps) => ReactGridLayoutProps;
}
