import type ReactGridLayout from 'react-grid-layout';

import type {OverlayCustomControlItem} from '../components/OverlayControls/OverlayControls';
import {MenuItems} from '../constants';
import {AdditionalWidgetLayout} from '../shared';

export type CompactType = ReactGridLayout.ReactGridLayoutProps['compactType'] | 'horizontal-nowrap';

export type ReactGridLayoutProps = Omit<
    ReactGridLayout.ReactGridLayoutProps,
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
    noOverlay?: boolean;
};

export interface Settings {
    gridLayout?: ReactGridLayoutProps;
    theme?: string;
    isMobile?: boolean;
    // @deprecated as it's possibly mutable property use Dashkit overlayMenuItems property instead
    menu?: Array<MenuItem>;
}

export type MenuItem = (typeof MenuItems)[keyof typeof MenuItems] | OverlayCustomControlItem;

export interface SettingsProps {
    autoupdateInterval: number;
    silentLoading: boolean;
}

export interface ContextProps {
    [key: string]: any;
}

export interface WidgetLayout extends AdditionalWidgetLayout {
    i: string;
    w: number;
    h: number;
    x: number;
    y: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
}
