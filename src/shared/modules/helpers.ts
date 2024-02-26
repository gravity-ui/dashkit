import get from 'lodash/get';
import invert from 'lodash/invert';
import isEmpty from 'lodash/isEmpty';
import keyBy from 'lodash/keyBy';
import pick from 'lodash/pick';

import {ACTION_PARAM_PREFIX, CURRENT_VERSION, META_KEY} from '../constants';
import {
    Config,
    ConfigAliases,
    ConfigConnection,
    ConfigItem,
    ConfigItemGroup,
    ConfigItemWithGroup,
    ConfigItemWithTabs,
    ItemStateAndParams,
    ItemsStateAndParams,
    ItemsStateAndParamsBase,
    PluginBase,
    QueueItem,
    StateAndParamsMetaData,
    StringParams,
} from '../types';

function getNormalizedPlugins(plugins: PluginBase[]) {
    return keyBy(plugins, 'type');
}

export function prerenderItems({
    items,
    plugins,
}: {
    items: ConfigItem[];
    plugins: PluginBase[];
}): ConfigItem[] {
    const normalizedPlugins = getNormalizedPlugins(plugins);
    return items.map((item) => {
        const {type} = item;
        const plugin = normalizedPlugins[type];
        return typeof plugin.prerenderMiddleware === 'function'
            ? plugin.prerenderMiddleware(item)
            : item;
    });
}

export function getItemsStateAndParamsMeta(itemsStateAndParams: ItemsStateAndParams) {
    const meta = itemsStateAndParams?.[META_KEY] as StateAndParamsMetaData | undefined;
    return meta;
}

export function getCurrentVersion(itemsStateAndParams: ItemsStateAndParams): number {
    if (isEmpty(itemsStateAndParams)) {
        return CURRENT_VERSION;
    }
    const meta = getItemsStateAndParamsMeta(itemsStateAndParams);
    if (!meta) {
        const withParams = Object.keys(itemsStateAndParams).some((id) => {
            return Boolean((itemsStateAndParams as ItemsStateAndParamsBase)[id].params);
        });
        if (withParams) {
            return 1;
        }
        return CURRENT_VERSION;
    }
    return meta.version;
}

function isConfigData(
    item: Pick<ConfigItem, 'data'> | ConfigItemGroup,
): item is Pick<ConfigItem, 'data'> {
    return 'data' in item && 'type' in item;
}

export function isItemWithTabs(
    item: Pick<ConfigItem, 'data'> | ConfigItemGroup,
): item is Pick<ConfigItemWithTabs, 'data'> {
    return isConfigData(item) && Array.isArray(item?.data?.tabs);
}

export function isItemWithGroup(
    item: Pick<ConfigItem, 'data'>,
): item is Pick<ConfigItemWithGroup, 'data'> {
    return Array.isArray(item?.data?.group);
}

export type FormedQueueData = {
    id: string;
    namespace: string;
    params: StringParams;
};

// Array of parameters from widgets according to queue
export function formQueueData({
    items,
    itemsStateAndParams,
}: {
    items: ConfigItem[];
    itemsStateAndParams: ItemsStateAndParams;
}): FormedQueueData[] {
    const queue = getItemsStateAndParamsMeta(itemsStateAndParams)?.queue || [];
    const keyById = keyBy(items, 'id');
    return queue.reduce((queueArray: FormedQueueData[], queueItem: QueueItem) => {
        const {id: queueId, tabId, groupItemId} = queueItem;
        const item = keyById[queueId];
        const isGroup = isItemWithGroup(item);
        if (!item || (isGroup && !groupItemId)) {
            return queueArray;
        }

        if (isGroup && groupItemId) {
            const itemQueueParams: Record<string, StringParams> = get(
                itemsStateAndParams,
                [item.id, 'params'],
                {},
            );

            const groupItem = item.data.group.find(({id}) => id === groupItemId);
            if (!groupItem) {
                return queueArray;
            }
            const groupItemQueueParams = itemQueueParams[groupItemId];
            const filteredParamsByDefaults = pick(
                groupItemQueueParams,
                Object.keys(groupItem.defaults || {}),
            );

            /**
             * merging filtered params and filtered actionParams with prefixes
             */
            const params = {
                ...filteredParamsByDefaults,
                ...(pickActionParamsFromParams(groupItemQueueParams, true) || {}),
            };

            queueArray.push({
                id: groupItem.id,
                namespace: groupItem.namespace,
                params,
            });

            return queueArray;
        }

        const itemQueueParams: StringParams = get(itemsStateAndParams, [item.id, 'params'], {});

        let itemDefaultParams: StringParams;
        if (isItemWithTabs(item)) {
            if (!tabId || resolveItemInnerId({item, itemsStateAndParams}) !== tabId) {
                return queueArray;
            }
            itemDefaultParams =
                item.data.tabs.find((tabData) => tabData.id === tabId)?.params || {};
        } else {
            itemDefaultParams = item.defaults || {};
        }

        const filteredParamsByDefaults = pick(itemQueueParams, Object.keys(itemDefaultParams));

        /**
         * merging filtered params and filtered actionParams with prefixes
         */
        const params = {
            ...filteredParamsByDefaults,
            ...(pickActionParamsFromParams(itemQueueParams, true) || {}),
        };

        queueArray.push({
            id: item.id,
            namespace: item.namespace,
            params,
        });

        return queueArray;
    }, []);
}

export function resolveItemInnerId({
    item,
    itemsStateAndParams,
}: {
    item: Pick<ConfigItemWithTabs, 'data' | 'id'>;
    itemsStateAndParams: ItemsStateAndParams;
}): string {
    const {id} = item;
    const stateTabId: string | undefined = (itemsStateAndParams as ItemsStateAndParamsBase)[id]
        ?.state?.tabId;
    const {tabs} = (item as ConfigItemWithTabs).data;
    if (stateTabId && tabs.some((tab) => tab.id === stateTabId)) {
        return stateTabId;
    }
    const indexIsDefault = tabs.findIndex(({isDefault}) => isDefault);
    return indexIsDefault === -1 ? tabs[0].id : tabs[indexIsDefault].id;
}

// В config.connections в from/to может быть как id item'a (item.id), так и id таба (item.data.tabs[].id)
// Тут мы нормализуем к виду Record<itemId: ignoredItemId[]>
export function getMapItemsIgnores({
    items,
    ignores,
    itemsStateAndParams,
    isFirstVersion,
}: {
    items: (ConfigItem | ConfigItemGroup)[];
    ignores: ConfigConnection[];
    itemsStateAndParams: ItemsStateAndParams;
    isFirstVersion: boolean;
}): Record<string, string[]> {
    // Record<itemId, innerId (tabId | itemId)>
    const mapIds = items.reduce((acc: Record<string, string>, item) => {
        return {
            ...acc,
            [item.id]: isItemWithTabs(item)
                ? resolveItemInnerId({item, itemsStateAndParams})
                : item.id,
        };
    }, {});
    // Record<innerId (tabId | itemId), itemId>
    const invertedMapIds = invert(mapIds);
    return items.reduce((acc: Record<string, string[]>, item) => {
        return {
            ...acc,
            [item.id]: ignores
                .filter(({from, to}) => {
                    if (isFirstVersion) {
                        // В первой версии был баг - если есть игнор на один таб, то весь виджет игнорит селектор.
                        // Повторяем это неправильное поведение,
                        // иначе будут прилетать дефолты селекта в табы, которые не игнорят.
                        const fromInTabs =
                            isItemWithTabs(item) && item.data.tabs.some(({id}) => id === from);
                        return (from === item.id || fromInTabs) && invertedMapIds[to];
                    }
                    return from === mapIds[item.id] && invertedMapIds[to];
                })
                .map(({to}) => invertedMapIds[to]),
        };
    }, {});
}

export function mergeParamsWithAliases({
    aliases,
    namespace,
    params,
    actionParams,
}: {
    aliases: ConfigAliases;
    namespace: string;
    params: StringParams;
    actionParams?: StringParams;
}): StringParams {
    const aliasesByNamespace = get(aliases, [namespace], []) as string[][];
    const items = {
        ...(params || {}),
        ...(actionParams || {}),
    };
    return Object.keys(items).reduce((matchedParams: StringParams, paramKey) => {
        const paramValue = items[paramKey];
        const collectAliasesParamsKeys = aliasesByNamespace.reduce(
            (collect, group) => {
                return group.includes(paramKey) ? collect.concat(group) : collect;
            },
            [paramKey],
        );
        return {
            ...matchedParams,
            ...collectAliasesParamsKeys.reduce((acc: StringParams, matchedKey) => {
                return {...acc, [matchedKey]: paramValue};
            }, {}),
        };
    }, {});
}

export function getInitialItemsStateAndParamsMeta(): StateAndParamsMetaData {
    return {
        queue: [],
        version: CURRENT_VERSION,
    };
}

interface ChangeQueueArg {
    id: string;
    tabId?: string;
    groupItemId?: string;
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
}

interface ChangeQueueGroupArg {
    id: string;
    groupItemIds: string[];
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
}

function getActualItems(items: ConfigItem[]) {
    return items.reduce((ids: string[], item) => {
        if (isItemWithGroup(item)) {
            item.data.group.forEach((groupItem) => {
                ids.push(groupItem.id);
            });
        }

        ids.push(item.id);
        return ids;
    }, []);
}

export function addToQueue({
    id,
    tabId,
    groupItemId,
    config,
    itemsStateAndParams,
}: ChangeQueueArg): StateAndParamsMetaData {
    const queueItem: QueueItem = {id};
    if (tabId) {
        queueItem.tabId = tabId;
    }
    if (groupItemId) {
        queueItem.groupItemId = groupItemId;
    }
    const meta = getItemsStateAndParamsMeta(itemsStateAndParams);
    if (!meta) {
        return {queue: [queueItem], version: CURRENT_VERSION};
    }
    const actualIds = getActualItems(config.items);
    const metaQueue = meta.queue || [];
    const notCurrent = (item: QueueItem) => {
        if (groupItemId && item.groupItemId) {
            return actualIds.includes(item.groupItemId) && item.groupItemId !== groupItemId;
        }
        return item.id !== id;
    };
    return {
        queue: metaQueue
            .filter((item) => actualIds.includes(item.id) && notCurrent(item))
            .concat(queueItem),
        version: meta.version || CURRENT_VERSION,
    };
}

export function addGroupToQueue({
    id,
    groupItemIds,
    config,
    itemsStateAndParams,
}: ChangeQueueGroupArg): StateAndParamsMetaData {
    const queueItems: QueueItem[] = groupItemIds.map((groupItemId) => ({
        id,
        groupItemId,
    }));
    const meta = getItemsStateAndParamsMeta(itemsStateAndParams);
    if (!meta) {
        return {queue: queueItems, version: CURRENT_VERSION};
    }
    const actualIds = getActualItems(config.items);
    const metaQueue = meta.queue || [];
    const notCurrent = (item: QueueItem) => {
        if (item.groupItemId) {
            return actualIds.includes(item.groupItemId) && !groupItemIds.includes(item.groupItemId);
        }
        return true;
    };
    return {
        queue: metaQueue
            .filter((item) => actualIds.includes(item.id) && notCurrent(item))
            .concat(queueItems),
        version: meta.version || CURRENT_VERSION,
    };
}

export function deleteFromQueue(data: ChangeQueueArg): StateAndParamsMetaData {
    const meta = addToQueue(data);
    return {
        ...meta,
        queue: meta.queue.slice(0, -1),
    };
}

/**
 * public function for getting only actionParams from object (all fields with keys that contains prefix)
 * @param params - object for pick fields
 * @param returnWithPrefix - format of returning actionParams fields (with actionParams prefix or without them)
 *
 * ex1: pickActionParamsFromParams({City: 'NY', _ap_Year: '2023'}, true) returns {_ap_Year: '2023'}
 * ex2: pickActionParamsFromParams({City: 'NY', _ap_Year: '2023'}) returns {Year: '2023'}
 */
export function pickActionParamsFromParams(
    params: ItemStateAndParams['params'],
    returnWithPrefix?: boolean,
) {
    if (!params || isEmpty(params)) {
        return {};
    }

    const actionParams: StringParams = {};
    for (const [key, val] of Object.entries(params)) {
        // starts with actionParams prefix (from'_ap_')
        if (key.startsWith(ACTION_PARAM_PREFIX)) {
            const paramName = returnWithPrefix ? key : key.slice(ACTION_PARAM_PREFIX.length);
            actionParams[paramName] = val;
        }
    }
    return actionParams;
}

/**
 * public function for getting params from object without actionParams
 * @param params
 */
export function pickExceptActionParamsFromParams(params: ItemStateAndParams['params']) {
    if (!params || isEmpty(params)) {
        return {};
    }

    const onlyParams: StringParams = {};
    for (const [key, val] of Object.entries(params)) {
        if (!key.startsWith(ACTION_PARAM_PREFIX)) {
            onlyParams[key] = val;
        }
    }
    return onlyParams;
}

/**
 * public function for transforming object to actionParams format
 * @param params
 */
export function transformParamsToActionParams(params: ItemStateAndParams['params']) {
    if (!params || isEmpty(params)) {
        return {};
    }

    const actionParams: StringParams = {};
    for (const [key, val] of Object.entries(params)) {
        actionParams[`${ACTION_PARAM_PREFIX}${key}`] = val;
    }
    return actionParams;
}

/**
 * check if object contains actionParams
 * @param conf
 */
export function hasActionParam(conf?: StringParams | Record<string, StringParams>): boolean {
    return Object.keys(conf || {}).some((key) => {
        if (conf && typeof conf[key] === 'object' && !Array.isArray(conf[key])) {
            return Object.keys(conf[key]).some((subkey) => subkey.startsWith(ACTION_PARAM_PREFIX));
        }
        return key.startsWith(ACTION_PARAM_PREFIX);
    });
}

/**
 * check if ItemStateAndParams object has actionParams in params or state field
 * @param stateAndParams
 */
export function hasActionParams(stateAndParams: ItemStateAndParams) {
    if (!stateAndParams || isEmpty(stateAndParams)) {
        return false;
    }

    return hasActionParam(stateAndParams.params);
}
