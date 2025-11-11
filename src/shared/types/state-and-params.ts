import {META_KEY} from '../constants';

import {StringParams} from './common';

export interface ItemState {
    [key: string]: any;
}

export type ItemParams = StringParams | Record<string, StringParams>;

export interface QueueItem {
    id: string;
    tabId?: string;
    groupItemId?: string;
}

export interface QueueGlobalItem {
    id: string;
    groupItemId?: string;
    params: StringParams;
}

export type StateAndParamsMetaData = {
    queue: QueueItem[];
    globalQueue?: QueueGlobalItem[];
    version: number;
};

export type StateAndParamsMeta = {
    [META_KEY]: StateAndParamsMetaData;
};

export type ItemStateAndParams = {
    params?: ItemParams;
    state?: ItemState;
};

export type ItemStateAndParamsChangeOptions = {
    action?: 'setParams' | 'removeItem';
    groupItemIds?: string[];
};

export type ItemsStateAndParamsBase = Record<string, ItemStateAndParams>;

export type ItemsStateAndParams = ItemsStateAndParamsBase | StateAndParamsMeta;
