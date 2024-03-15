import React from 'react';

import ReactGridLayout from 'react-grid-layout';

import {
    ConfigItem,
    ItemState,
    ItemStateAndParams,
    ItemStateAndParamsChangeOptions,
    PluginBase,
    StringParams,
} from '../shared';

import {ContextProps, SettingsProps, WidgetLayout} from './common';

export interface PluginWidgetProps<T = StringParams> {
    id: string;
    editMode: boolean;
    params: T;
    state: ItemState;
    onStateAndParamsChange: (
        stateAndParams: ItemStateAndParams,
        options?: ItemStateAndParamsChangeOptions,
    ) => void;
    width: number;
    height: number;
    data: ConfigItem['data'];
    defaults: ConfigItem['defaults'];
    namespace: ConfigItem['namespace'];
    settings: SettingsProps;
    context: ContextProps;
    layout: WidgetLayout[];
    gridLayout: ReactGridLayout.ReactGridLayoutProps;
    adjustWidgetLayout: (data: {
        widgetId: string;
        needSetDefault?: boolean;
        adjustedWidgetLayout?: WidgetLayout;
    }) => void;
}

export interface PluginDefaultLayout {
    w?: number;
    h?: number;
    x?: number;
    y?: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
}

export interface Plugin<P extends PluginWidgetProps<T> = any, T = StringParams> extends PluginBase {
    defaultLayout?: PluginDefaultLayout;
    renderer: (props: P, forwardedRef: React.RefObject<any>) => React.ReactNode;
}
