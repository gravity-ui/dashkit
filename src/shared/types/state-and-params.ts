import {META_KEY} from '../constants';

import {StringParams} from './common';

export interface ItemState {
    [key: string]: any;
}

export interface QueueItem {
    id: string;
    tabId?: string;
}

export type StateAndParamsMetaData = {
    queue: QueueItem[];
    version: number;
};

export type StateAndParamsMeta = {
    [META_KEY]: StateAndParamsMetaData;
};

export type ItemStateAndParams = {
    params?: StringParams;
    state?: ItemState;
};

export type ItemStateAndParamsChangeOptions = {
    action: 'setParams' | 'removeItem';
};

export type ItemsStateAndParamsBase = Record<string, ItemStateAndParams>;

export type ItemsStateAndParams = ItemsStateAndParamsBase | StateAndParamsMeta;
