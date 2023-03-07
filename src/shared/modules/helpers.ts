import keyBy from 'lodash/keyBy';
import get from 'lodash/get';
import invert from 'lodash/invert';
import isEmpty from 'lodash/isEmpty';
import pick from 'lodash/pick';
import {META_KEY, CURRENT_VERSION} from '../constants';
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

// Массив параметров, которые исходят от виджетов, согласно очереди
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
            return {
                id: item.id,
                namespace: item.namespace,
                params: pick(itemQueueParams, Object.keys(itemDefaultParams)),
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

function mergeParamsItemsWithAliases(
    aliasesByNamespace: string[][],
    items: StringParams,
    additionalItems = {},
): StringParams {
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
            ...additionalItems,
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

    let actionParamsWithAliases = {};
    if (actionParams && Object.entries(actionParams).length) {
        actionParamsWithAliases = mergeParamsItemsWithAliases(aliasesByNamespace, actionParams);
    }

    return mergeParamsItemsWithAliases(aliasesByNamespace, params, actionParamsWithAliases);
}

export function mergeParamsNamesWithAliases({
    aliases,
    namespace,
    paramsNames,
}: {
    aliases: ConfigAliases;
    namespace: string;
    paramsNames: Array<string>;
}): Array<string> {
    const aliasesByNamespace = get(aliases, [namespace], []) as string[][];
    return Array.from(
        new Set([
            ...paramsNames.reduce((matchedParams: Array<string>, paramKey: string) => {
                const collectAliasesParamsKeys = aliasesByNamespace.reduce(
                    (collect, group) => {
                        return group.includes(paramKey) ? collect.concat(group) : collect;
                    },
                    [paramKey],
                );
                return [...matchedParams, ...collectAliasesParamsKeys];
            }, []),
        ]),
    );
}

export function mergeParamsNamesWithPairAliases({
    aliases,
    namespace,
    paramsNames,
}: {
    aliases: ConfigAliases;
    namespace: string;
    paramsNames: Array<string>;
}): Array<Array<string>> {
    const aliasesByNamespace = get(aliases, [namespace], []) as Array<Array<string>>;
    const res = [] as Array<Array<string>>; // string[][];
    paramsNames.forEach((paramName) => {
        res.push(...aliasesByNamespace.filter((item) => item.includes(paramName)));
    });
    /*const tmpRes = paramsNames.reduce((matchedParams: Array<string>, paramKey: string) => {
        const collectAliasesParamsKeys = aliasesByNamespace.reduce(
            (collect, group) => {
                debugger;
                return group.includes(paramKey) ? collect.concat(group) : collect;
            },
            [paramKey],
        );
        return [...matchedParams, ...collectAliasesParamsKeys];
    }, []);
    const tmpSet = new Set([...tmpRes]);*/
    //const res = Array.from(tmpSet);
    return res;
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
