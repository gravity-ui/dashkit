import React from 'react';

import type {
    ConfigItem,
    ItemState,
    ItemStateAndParams,
    ItemStateAndParamsChangeOptions,
    PluginBase,
    StringParams,
} from '../shared';

import type {ContextProps, ReactGridLayoutProps, SettingsProps, WidgetLayout} from './common';

export interface PluginWidgetProps<T = StringParams> {
    id: string;
    editMode: boolean;
    params: T;
    state: ItemState;
    onStateAndParamsChange: (
        stateAndParams: ItemStateAndParams,
        options?: ItemStateAndParamsChangeOptions,
    ) => void;
    // Plugins may retain completion to report visual updates after they commit. Suppress
    // superseded request completions and retained notifications while a newer load is pending.
    // DashKit suppresses callbacks after unmount or item replacement.
    onBeforeLoad: () => () => void;
    width?: number;
    height?: number;
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

export type PluginDefaultLayout = Partial<Omit<WidgetLayout, 'i'>>;

export type PluginRef = object | null;

export interface Plugin<P extends PluginWidgetProps<T> = any, T = StringParams> extends PluginBase {
    defaultLayout?: PluginDefaultLayout;
    renderer: (
        props: P,
        forwardedRef: ((instance: PluginRef) => void) | undefined,
    ) => React.ReactNode;
    placeholderRenderer?: (
        props: P,
        forwardedRef: ((instance: PluginRef) => void) | undefined,
    ) => React.ReactNode;
}
