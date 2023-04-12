import keyBy from 'lodash/keyBy';
import get from 'lodash/get';
import invert from 'lodash/invert';
import isEmpty from 'lodash/isEmpty';
import pick from 'lodash/pick';
import intersection from 'lodash/intersection';
import {META_KEY, CURRENT_VERSION, ACTION_PARAM_PREFIX} from '../constants';
import {
    PluginBase,
    ConfigItem,
    ItemsStateAndParams,
    ItemsStateAndParamsBase,
    StateAndParamsMetaData,
    StringParams,
    ConfigConnection,
    ConfigAliases,
    ConfigItemWithTabs,
    Config,
    QueueItem,
    ItemStateAndParams,
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

function nonNullable<T>(value: T): value is NonNullable<T> {
    return value !== null && value !== undefined;
}

export function isItemWithTabs(
    item: Pick<ConfigItem, 'data'>,
): item is Pick<ConfigItemWithTabs, 'data'> {
    return Array.isArray(item?.data?.tabs);
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
    return queue
        .map((queueItem) => {
            const {id: queueId, tabId} = queueItem;
            const item = keyById[queueId];
            if (!item) {
                return null;
            }
            let itemDefaultParams: StringParams;
            if (isItemWithTabs(item)) {
                if (!tabId || resolveItemInnerId({item, itemsStateAndParams}) !== tabId) {
                    return null;
                }
                itemDefaultParams =
                    item.data.tabs.find((tabData) => tabData.id === tabId)?.params || {};
            } else {
                itemDefaultParams = item.defaults || {};
            }

            const itemQueueParams: StringParams = get(itemsStateAndParams, [item.id, 'params'], {});
            const filteredParamsByDefaults = pick(itemQueueParams, Object.keys(itemDefaultParams));

            /**
             * filtering actionParams without prefixes by defaults params
             * ex.:
             * itemDefaultParams contains 'Country' in defaults
             * and we receive '_ap_Country' and '_ap_City' in itemQueueParams
             * we need to ignore '_ap_City' param because we don't have actionParam without prefix ('City') in defaults
             */
            const actionParams = pickActionParamsFromParams(itemQueueParams, false) || {};
            const filteredActionParamsByDefaults = pick(
                actionParams,
                Object.keys(itemDefaultParams),
            );

            /**
             * merging filtered params and filtered actionParams with prefixes
             */
            const params = {
                ...filteredParamsByDefaults,
                ...transformParamsToActionParams(filteredActionParamsByDefaults),
            };

            return {
                id: item.id,
                namespace: item.namespace,
                params,
            };
        })
        .filter(nonNullable);
}

export function resolveItemInnerId({
    item,
    itemsStateAndParams,
}: {
    item: ConfigItem;
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
    items: ConfigItem[];
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
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
}

export function addToQueue({
    id,
    tabId,
    config,
    itemsStateAndParams,
}: ChangeQueueArg): StateAndParamsMetaData {
    const queueItem: QueueItem = {id};
    if (tabId) {
        queueItem.tabId = tabId;
    }
    const meta = getItemsStateAndParamsMeta(itemsStateAndParams);
    if (!meta) {
        return {queue: [queueItem], version: CURRENT_VERSION};
    }
    const {items} = config;
    const actualIds = items.map((item) => item.id);
    const metaQueue = meta.queue || [];
    return {
        queue: metaQueue
            .filter((item) => actualIds.includes(item.id) && item.id !== id)
            .concat(queueItem),
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
export function hasActionParam(conf?: StringParams): boolean {
    return Object.keys(conf || {}).some((key) => key.startsWith(ACTION_PARAM_PREFIX));
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

/**
 * Collect array of actionParams keys with prefix (_ap_) that must be cleared from widget defaults
 * @param widgetDefaults
 * @param queueDataItems
 * @param itemParams
 */
export function getDefaultsActionParamsToClear({
    widgetDefaults,
    queueDataItems,
    itemParams,
}: {
    widgetDefaults: StringParams;
    queueDataItems: StringParams;
    itemParams: StringParams;
}) {
    const widgetDefaultsWithActionParams = hasActionParam(widgetDefaults)
        ? pickActionParamsFromParams(widgetDefaults)
        : null;

    if (!widgetDefaultsWithActionParams) {
        return [];
    }

    // clear default actionParams if some param with the same name without prefix affected on current widget
    // ex.: queueDataItems contain {Year: 1970} and default actionParams contain {_ap_Year: 2000}
    const actionParamKeyToClear: string[] = intersection(
        Object.keys(queueDataItems),
        Object.keys(widgetDefaultsWithActionParams),
    );

    // if itemParams contain {Year: 1970} and actionParam has default widget value {_ap_Year: 2000}
    // than clear such actionParam
    const keysForCheckDefaultAvailableValues = intersection(
        Object.keys(itemParams),
        Object.keys(widgetDefaultsWithActionParams),
    );

    keysForCheckDefaultAvailableValues.forEach((key) => {
        const normalizedItemVal: string[] = Array.isArray(itemParams[key])
            ? (itemParams[key] as string[])
            : ([itemParams[key]] as string[]);

        const normalizedDefaultVal: string[] = Array.isArray(widgetDefaultsWithActionParams[key])
            ? (widgetDefaultsWithActionParams[key] as string[])
            : ([widgetDefaultsWithActionParams[key]] as string[]);

        // check that all values in actionParams defaults are contained in itemParams by same key
        // else need to clear
        for (let i = 0; i < normalizedDefaultVal.length; i++) {
            if (!normalizedDefaultVal[i] || !normalizedItemVal.includes(normalizedDefaultVal[i])) {
                actionParamKeyToClear.push(key);
                continue;
            }
        }
    });

    return actionParamKeyToClear.length
        ? actionParamKeyToClear.map((key) => `${ACTION_PARAM_PREFIX}${key}`)
        : [];
}
