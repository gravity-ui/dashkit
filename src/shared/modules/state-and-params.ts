import groupBy from 'lodash/groupBy';

import {META_KEY} from '../constants';
import {
    Config,
    ConfigItem,
    ConfigItemDataWithTabs,
    ConfigItemGroup,
    GlobalParams,
    ItemState,
    ItemStateAndParams,
    ItemsStateAndParams,
    ItemsStateAndParamsBase,
    PluginBase,
    StateAndParamsMetaData,
    StringParams,
} from '../types';

import {
    FormedQueueData,
    formQueueData,
    getCurrentVersion,
    getMapItemsIgnores,
    hasActionParam,
    isItemWithGroup,
    isItemWithTabs,
    mergeParamsWithAliases,
    pickActionParamsFromParams,
    pickExceptActionParamsFromParams,
    prerenderItems,
    resolveItemInnerId,
} from './helpers';

export interface GetItemsParamsArg {
    defaultGlobalParams: GlobalParams;
    globalParams: GlobalParams;
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
    plugins: PluginBase[];
}

type GetItemsParamsReturn = Record<string, StringParams | Record<string, StringParams>>;

function getItemParams({
    item,
    itemsStateAndParams,
    mapItemsIgnores,
    itemsWithDefaultsByNamespace,
    getMergedParams,
    defaultGlobalParams,
    globalParams,
    isFirstVersion,
    queueData,
}: {
    item: ConfigItem | ConfigItemGroup;
    itemsStateAndParams: ItemsStateAndParams;
    mapItemsIgnores: Record<string, string[]>;
    itemsWithDefaultsByNamespace: Record<string, (ConfigItem | ConfigItemGroup)[]>;
    getMergedParams: (params: StringParams, actionParams?: StringParams) => StringParams;
    defaultGlobalParams: StringParams;
    globalParams: GlobalParams;
    isFirstVersion: boolean;
    queueData: FormedQueueData[];
}) {
    const {id, namespace} = item;

    let defaultWidgetParams: StringParams | Record<string, StringParams> = {};
    if (isItemWithTabs(item)) {
        const currentWidgetTabId = resolveItemInnerId({item, itemsStateAndParams});
        const itemTabs: ConfigItemDataWithTabs['tabs'] = item.data.tabs;
        defaultWidgetParams =
            itemTabs.find((tabItem) => tabItem?.id === currentWidgetTabId)?.params || {};
    } else {
        defaultWidgetParams = item.defaults || {};
    }

    const itemIgnores = mapItemsIgnores[id];

    const affectingItemsWithDefaults = itemsWithDefaultsByNamespace[namespace].filter(
        (itemWithDefaults) => !itemIgnores.includes(itemWithDefaults.id),
    );

    let itemParams: StringParams = Object.assign(
        {},
        getMergedParams(defaultGlobalParams),
        // default parameters to begin with
        affectingItemsWithDefaults.reduceRight((defaultParams: StringParams, itemWithDefaults) => {
            return {
                ...defaultParams,
                ...getMergedParams(itemWithDefaults.defaults || {}),
            };
        }, {}),
        getMergedParams(globalParams),
    );
    if (isFirstVersion) {
        itemParams = Object.assign(
            itemParams,
            (itemsStateAndParams as ItemsStateAndParamsBase)?.[id]?.params || {},
        );
    } else {
        // params according to queue of its applying
        let queueDataItemsParams: StringParams = {};
        for (const data of queueData) {
            if (data.namespace !== namespace || itemIgnores.includes(data.id)) {
                continue;
            }

            let actionParams;
            let params = data.params;
            const needAliasesForActionParams = data.id !== id && hasActionParam(data.params);
            if (needAliasesForActionParams) {
                actionParams = pickActionParamsFromParams(data.params);
                params = pickExceptActionParamsFromParams(data.params);
            }

            const mergedParams = getMergedParams(params, actionParams);

            queueDataItemsParams = {
                ...queueDataItemsParams,
                ...mergedParams,
            };
        }

        itemParams = Object.assign(itemParams, queueDataItemsParams);
    }

    return {...defaultWidgetParams, ...itemParams};
}

export function getItemsParams({
    defaultGlobalParams = {},
    globalParams = {},
    config,
    itemsStateAndParams,
    plugins,
}: GetItemsParamsArg): GetItemsParamsReturn {
    const {aliases, connections} = config;
    const items = prerenderItems({items: config.items, plugins});
    const isFirstVersion = getCurrentVersion(itemsStateAndParams) === 1;

    const allItems = items.reduce((paramsItems: (ConfigItem | ConfigItemGroup)[], item) => {
        if (isItemWithGroup(item)) {
            item.data.group.forEach((groupItem) => {
                paramsItems.push(groupItem);
            });

            return paramsItems;
        }

        paramsItems.push(item);
        return paramsItems;
    }, []);

    const queueData: FormedQueueData[] = isFirstVersion
        ? []
        : formQueueData({items, itemsStateAndParams});

    // to consider other kind types in future (not only ignore)
    const mapItemsIgnores = getMapItemsIgnores({
        items: allItems,
        ignores: connections.filter(({kind}) => kind === 'ignore'),
        itemsStateAndParams,
        isFirstVersion,
    });
    const groupByNamespace = groupBy(allItems, 'namespace');
    const itemsWithDefaultsByNamespace = Object.keys(groupByNamespace).reduce(
        (acc, namespace) => {
            return {
                ...acc,
                // there are defaults only in selectors by now, need to get them from item.data.tabs[].defaults for widgets
                // but make a decision about there's order first
                [namespace]: groupByNamespace[namespace].filter((item) => item.defaults),
            };
        },
        {} as Record<string, (ConfigItem | ConfigItemGroup)[]>,
    );

    return items.reduce((itemsParams: GetItemsParamsReturn, item: ConfigItem) => {
        const {id, namespace} = item;

        const getMergedParams = (params: StringParams, actionParams?: StringParams) =>
            mergeParamsWithAliases({aliases, namespace, params: params || {}, actionParams});

        const paramsOptions = {
            itemsStateAndParams,
            mapItemsIgnores,
            itemsWithDefaultsByNamespace,
            getMergedParams,
            defaultGlobalParams,
            globalParams,
            isFirstVersion,
            queueData,
        };

        if (isItemWithGroup(item)) {
            const groupParams = item.data.group.reduce(
                (groupItemParams: Record<string, StringParams>, groupItem) => {
                    groupItemParams[groupItem.id] = getItemParams({
                        item: groupItem,
                        ...paramsOptions,
                    });
                    return groupItemParams;
                },
                {},
            );

            return {...itemsParams, [id]: groupParams};
        }

        return {
            ...itemsParams,
            [id]: getItemParams({
                item,
                ...paramsOptions,
            }),
        };
    }, {});
}

export function getItemsState({
    config,
    itemsStateAndParams,
}: {
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
}) {
    return config.items.reduce((acc: Record<string, ItemState>, {id}) => {
        acc[id] = (itemsStateAndParams as ItemsStateAndParamsBase)?.[id]?.state || {};
        return acc;
    }, {});
}

export function getItemsStateAndParams({
    defaultGlobalParams = {},
    globalParams = {},
    config,
    itemsStateAndParams,
    plugins,
}: GetItemsParamsArg): ItemsStateAndParams {
    const params = getItemsParams({
        defaultGlobalParams,
        globalParams,
        config,
        itemsStateAndParams,
        plugins,
    });
    const state = getItemsState({config, itemsStateAndParams});
    const uniqIds = new Set([...Object.keys(params), ...Object.keys(state)]);

    const result: ItemsStateAndParams = Array.from(uniqIds).reduce(
        (acc: ItemsStateAndParams, id) => {
            const data = {} as ItemStateAndParams;
            if (id in params) {
                data.params = params[id];
            }
            if (id in state) {
                data.state = state[id];
            }
            return {
                ...acc,
                [id]: data,
            };
        },
        {},
    );
    const version = getCurrentVersion(itemsStateAndParams);
    if (version === 1) {
        return result;
    }
    const meta = {
        [META_KEY]: itemsStateAndParams[META_KEY] as StateAndParamsMetaData,
    };
    return {
        ...meta,
        ...result,
    };
}
