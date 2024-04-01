import type ReactGridLayout from 'react-grid-layout';

import {type OverlayCustomControlItem} from '../components/OverlayControls/OverlayControls';
import {MenuItems} from '../constants';

export interface Settings {
    gridLayout?: ReactGridLayout.ReactGridLayoutProps;
    theme?: string;
    isMobile?: boolean;
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

export interface WidgetLayout {
    i: string;
    w: number;
    h: number;
    x: number;
    y: number;
    minW: number;
    minH: number;
    maxW?: number;
    maxH?: number;
}
