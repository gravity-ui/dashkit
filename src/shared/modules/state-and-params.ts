import groupBy from 'lodash/groupBy';
import intersection from 'lodash/intersection';
import omit from 'lodash/omit';
import {META_KEY} from '../constants';
import {
    GlobalParams,
    Config,
    ItemsStateAndParams,
    PluginBase,
    ConfigItem,
    StringParams,
    ItemState,
    ItemsStateAndParamsBase,
    StateAndParamsMetaData,
    ItemStateAndParams,
    ConfigItemDataWithTabs,
} from '../types';
import {
    prerenderItems,
    formQueueData,
    FormedQueueData,
    getMapItemsIgnores,
    mergeParamsWithAliases,
    getCurrentVersion,
    pickActionParamsFromParams,
    hasActionParam,
    pickExceptActionParamsFromParams,
    transformParamsToActionParams,
    isItemWithTabs,
    resolveItemInnerId,
} from './helpers';

export interface GetItemsParamsArg {
    defaultGlobalParams: GlobalParams;
    globalParams: GlobalParams;
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
    plugins: PluginBase[];
}

type GetItemsParamsReturn = Record<string, StringParams>;

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
    const queueData: FormedQueueData[] = isFirstVersion
        ? []
        : formQueueData({items, itemsStateAndParams});

    // to consider other kind types in future (not only ignore)
    const mapItemsIgnores = getMapItemsIgnores({
        items,
        ignores: connections.filter(({kind}) => kind === 'ignore'),
        itemsStateAndParams,
        isFirstVersion,
    });
    const groupByNamespace = groupBy(items, 'namespace');
    const itemsWithDefaultsByNamespace = Object.keys(groupByNamespace).reduce((acc, namespace) => {
        return {
            ...acc,
            // there are defaults only in selectors by now, need to get them from item.data.tabs[].defaults for widgets
            // but make a decision about there's order first
            [namespace]: groupByNamespace[namespace].filter((item) => item.defaults),
        };
    }, {} as Record<string, ConfigItem[]>);

    return items.reduce((itemsParams: Record<string, StringParams>, item) => {
        const {id, namespace} = item;

        let widgetDefaults: StringParams = {};
        if (isItemWithTabs(item)) {
            const currentWidgetTabId = resolveItemInnerId({item, itemsStateAndParams});
            const itemTabs: ConfigItemDataWithTabs['tabs'] = item.data.tabs;
            widgetDefaults =
                itemTabs.find((tabItem) => tabItem?.id === currentWidgetTabId)?.params || {};
        } else {
            widgetDefaults = item.defaults || {};
        }

        const getMergedParams = (params: StringParams, actionParams?: StringParams) =>
            mergeParamsWithAliases({aliases, namespace, params: params || {}, actionParams});
        const itemIgnores = mapItemsIgnores[id];
        const affectingItemsWithDefaults = itemsWithDefaultsByNamespace[namespace].filter(
            (itemWithDefaults) => !itemIgnores.includes(itemWithDefaults.id),
        );

        let itemParams: StringParams = Object.assign(
            {},
            getMergedParams(defaultGlobalParams),
            // default parameters to begin with
            affectingItemsWithDefaults.reduceRight(
                (defaultParams: StringParams, itemWithDefaults) => {
                    return {
                        ...defaultParams,
                        ...getMergedParams(itemWithDefaults.defaults || {}),
                    };
                },
                {},
            ),
            getMergedParams(globalParams),
        );
        if (isFirstVersion) {
            itemParams = Object.assign(
                itemParams,
                (itemsStateAndParams as ItemsStateAndParamsBase)?.[id]?.params || {},
            );
        } else {
            // params according to queue of its applying
            let prevQueueDataWithActionParams = {};
            let queueDataItems: StringParams = {};
            for (const data of Object.values(queueData)) {
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

                const actionParamKeyToClear = intersection(
                    Object.keys(transformParamsToActionParams(mergedParams)),
                    Object.keys(prevQueueDataWithActionParams),
                );

                let queueDataRes = {...queueDataItems};
                if (actionParamKeyToClear.length) {
                    queueDataRes = omit(queueDataItems, actionParamKeyToClear);
                }

                queueDataItems = {
                    ...queueDataRes,
                    ...mergedParams,
                };

                prevQueueDataWithActionParams = hasActionParam(queueDataItems)
                    ? pickActionParamsFromParams(data.params, true)
                    : {};
            }

            itemParams = Object.assign(itemParams, queueDataItems);
        }

        return {
            ...itemsParams,
            [id]: {...widgetDefaults, ...itemParams},
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
