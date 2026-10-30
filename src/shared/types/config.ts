import {StringParams} from './common';

export interface AdditionalWidgetLayout {
    parent?: string;
    containerId?: string;
}

export interface ConfigLayout extends AdditionalWidgetLayout {
    i: string;
    h: number;
    w: number;
    x: number;
    y: number;
}

export const CONFIG_LAYOUT_FIELDS = [
    'i',
    'h',
    'w',
    'x',
    'y',
    'parent',
    'containerId',
] as const satisfies ReadonlyArray<keyof ConfigLayout>;
export type ConfigLayoutField = (typeof CONFIG_LAYOUT_FIELDS)[number];

type ImpactType = 'allTabs' | 'asGroup' | 'selectedTabs' | 'currentTab';
type ImpactTabsIds = string[] | null;

export type ConfigItemGroup = {
    id: string;
    defaults?: StringParams;
    namespace: string;
    impactType?: ImpactType;
    impactTabsIds?: ImpactTabsIds;
    [key: string]: unknown;
};

export interface ConfigItemData {
    _editActive?: boolean;
    tabs?: {
        id: string;
        isDefault?: boolean;
        params?: StringParams;
        [key: string]: unknown;
    }[];
    group?: ConfigItemGroup[];
    impactType?: Exclude<ImpactType, 'asGroup'>;
    impactTabsIds?: ImpactTabsIds;
    [key: string]: unknown;
}

export interface ConfigItemDataWithTabs extends Omit<ConfigItemData, 'tabs'> {
    tabs: NonNullable<ConfigItemData['tabs']>;
}

export interface ConfigItemDataWithGroup extends Omit<ConfigItemData, 'group'> {
    group: NonNullable<ConfigItemData['group']>;
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

export interface ConfigItemWithGroup extends Omit<ConfigItem, 'data'> {
    data: ConfigItemDataWithGroup;
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
    id?: string;
    layoutVersion?: 2;
    containers?: LayoutContainer[];
    salt: string;
    counter: number;
    items: ConfigItem[];
    globalItems?: ConfigItem[];
    layout: ConfigLayout[];
    aliases: ConfigAliases;
    connections: ConfigConnection[];
}

/** Persisted nested layout. Runtime zone render functions remain in DashKitGroup. */
export type LayoutContainer = Omit<ConfigLayout, 'i'> & {
    id: string;
    padding: [number, number, number, number];
    gap: [number, number];
    grid: {
        cols: number;
        rowHeight: number;
        compactType: 'vertical' | 'horizontal' | 'horizontal-nowrap' | null;
        allowOverlap?: boolean;
        maxRows?: number;
    };
};

/** Compatibility name for existing GridStack consumers. */
export type GridStackContainer = LayoutContainer;
