import React from 'react';

import type {ReactGridLayoutProps} from 'react-grid-layout';

import {
    ConfigItem,
    ItemState,
    ItemStateAndParams,
    ItemStateAndParamsChangeOptions,
    PluginBase,
    StringParams,
} from '../shared';

import {ContextProps, SettingsProps, WidgetLayout} from './common';

export interface PluginWidgetProps {
    id: string;
    editMode: boolean;
    params: StringParams;
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
    gridLayout: ReactGridLayoutProps;
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

export interface Plugin<P extends PluginWidgetProps = any> extends PluginBase {
    defaultLayout?: PluginDefaultLayout;
    renderer: (props: P, forwardedRef: React.RefObject<any>) => React.ReactNode;
}
