import {StringParams} from './common';

export interface ConfigLayout {
    i: string;
    h: number;
    w: number;
    x: number;
    y: number;
}

export interface ConfigItemData {
    _editActive?: boolean;
    tabs?: {
        id: string;
        isDefault?: boolean;
        params?: StringParams;
        [key: string]: unknown;
    }[];
    [key: string]: unknown;
}

export interface ConfigItemDataWithTabs extends Omit<ConfigItemData, 'tabs'> {
    tabs: NonNullable<ConfigItemData['tabs']>;
}

export interface ConfigItem {
    id: string;
    data: ConfigItemData;
    type: string;
    namespace: string;
    defaults?: StringParams;
    orderId?: number;
    defaultOrderId?: number;
}

export interface ConfigItemWithTabs extends Omit<ConfigItem, 'data'> {
    data: ConfigItemDataWithTabs;
}

export interface ConfigAliases {
    [namespace: string]: string[][]; // в массивах имена параметров
}

export interface ConfigConnection {
    from: string;
    to: string;
    kind: 'ignore'; // пока один kind
}

export interface Config {
    salt: string;
    counter: number;
    items: ConfigItem[];
    layout: ConfigLayout[];
    aliases: ConfigAliases;
    connections: ConfigConnection[];
}
