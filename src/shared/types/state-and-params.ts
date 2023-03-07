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
    actionParams?: StringParams /*Array<string> /*{
        [key: string]: StringParams; // widgetId: paramName - какой виджет привёл к обновлению и список параметров с обновлением
    }*/;
};

export type ItemsStateAndParamsBase = Record<string, ItemStateAndParams>;

export type ItemsStateAndParams = ItemsStateAndParamsBase | StateAndParamsMeta;
