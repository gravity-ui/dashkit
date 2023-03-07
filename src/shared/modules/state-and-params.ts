import groupBy from 'lodash/groupBy';
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
} from '../types';
import {
    prerenderItems,
    formQueueData,
    FormedQueueData,
    getMapItemsIgnores,
    mergeParamsWithAliases,
    getCurrentVersion,
} from './helpers';
import {META_KEY} from '../constants';

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
    const actionParams =
        getItemsActionParams({
            config,
            itemsStateAndParams,
        }) || {};
    //console.log('getItemsParams::actionParams', actionParams);
    const items = prerenderItems({items: config.items, plugins});
    const isFirstVersion = getCurrentVersion(itemsStateAndParams) === 1;
    const queueData: FormedQueueData[] = isFirstVersion
        ? []
        : formQueueData({items, itemsStateAndParams});
    // В будущем учитывать не только игноры, когда такой kind появится
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
            // Сейчас дефолты только у Селектов, затем для виджетов нужно доставать из item.data.tabs[].defaults
            // но определиться с порядком их применения
            [namespace]: groupByNamespace[namespace].filter((item) => item.defaults),
        };
    }, {} as Record<string, ConfigItem[]>);

    return items.reduce((itemsParams: Record<string, StringParams>, item) => {
        const {id, namespace} = item;

        let actions: StringParams = {};
        for (const [key, val] of Object.entries(actionParams)) {
            if (!actions) {
                actions = {};
            }
            if (key !== id) {
                actions = {...actions, ...val};
            }
        }

        const getMergedParams = (params: StringParams, actions?: StringParams) =>
            mergeParamsWithAliases({
                aliases,
                namespace,
                params: params || {},
                actionParams: actions,
            });

        const itemIgnores = mapItemsIgnores[id];
        const affectingItemsWithDefaults = itemsWithDefaultsByNamespace[namespace].filter(
            (itemWithDefaults) => !itemIgnores.includes(itemWithDefaults.id),
        );
        let itemParams: StringParams = Object.assign(
            {},
            getMergedParams(defaultGlobalParams),
            // Стартовые дефолтные параметры
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
            itemParams = Object.assign(
                itemParams,
                // Параметры согласно очереди применения параметров
                queueData.reduce((queueParams: StringParams, data) => {
                    if (data.namespace !== namespace || itemIgnores.includes(data.id)) {
                        return queueParams;
                    }
                    return {
                        ...queueParams,
                        ...getMergedParams(data.params, actions),
                    };
                }, {}),
            );
        }
        return {
            ...itemsParams,
            [id]: itemParams,
        };
    }, {});
}

export function getItemsActionParams({
    config,
    itemsStateAndParams,
}: {
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
}): GetItemsParamsReturn {
    //console.log('itemsStateAndParams', itemsStateAndParams);

    //const {aliases} = config;

    /*const getMergedParams = (params: StringParams, namespace: string) =>
        mergeParamsWithAliases({aliases, namespace, params: params || {}}) || {};*/
    //console.log('getMergedParams', getMergedParams);

    const res = config.items.reduce((acc, {id}) => {
        // @ts-ignore
        acc = {...acc, [id]: itemsStateAndParams?.[id]?.actionParams || {}};
        return acc;
    }, {});

    /*7o:
        params: {50927ab0-3a7e-11ec-965f-71d239562ffc: Array(2)}
    triggers: {}
    [[Prototype]]: Object
    Q8:
        params: {Year: Array(2), Country: ''}
    triggers: {Country: 'Беларусь'}
    [[Prototype]]: Object
    __meta__: {queue: Array(2), version: 2}*/

    //const;
    // itemsStateAndParams = {
    // Q8: {
    //      params: {Year: '2018', Country: 'Италия'}
    //      triggers: {Q8: {…}}
    // }
    // __meta__: {queue: Array(1), version: 2}

    /*const rrres = config.items.reduce((acc: Record<string, any>, {id, namespace}) => {
        const tmp = (itemsStateAndParams as ItemsStateAndParamsBase)?.[id]?.triggers || {};
        //@ts-ignore
        const tmp2 = (tmp?.[id] && getMergedParams(tmp[id], 'default')) || {};
        console.log('tmp2', tmp2);
        /!*Object.keys(tmp2);*!/
        const res = getMergedParams(tmp2, namespace);
        console.log('res', res);
        acc = {...acc, [id]: res};
        //@ts-ignore
        console.log('acc', acc);
        return acc;
    }, {});*/

    /*const rrres = config.items.reduce((acc: Record<string, any>, {id, namespace}) => {
        const tmp = (itemsStateAndParams as ItemsStateAndParamsBase)?.[id]?.triggers || {};
        //@ts-ignore
        /!*const tmp2 = (tmp?.length && getMergedParams(tmp, namespace)) || [];
        console.log('tmp2', tmp2);
        /!*Object.keys(tmp2);*!/
        //const res = getMergedParams(tmp2, namespace);
        //console.log('res', res);*!/
        // acc = {...acc, [id]: (Object.keys(tmp || {}).length && getMergedParams(tmp, namespace)) || {}};
        console.log('tmp', tmp);
        console.log('getMergedParams(tmp, namespace)', getMergedParams(tmp, namespace));
        console.log('(itemsStateAndParams as ItemsStateAndParamsBase)?.[id]?.triggers || {}', (itemsStateAndParams as ItemsStateAndParamsBase)?.[id]?.triggers || {});
        /!*const itemParams = Object.assign(
            {},
                ...getMergedParams(tmp, namespace),
            (itemsStateAndParams as ItemsStateAndParamsBase)?.[id]?.triggers || {},
        );*!/
        return {
            ...acc,
            //[id]: itemParams,
        };
        //@ts-ignore
        //console.log('acc', acc);
        //return acc;
    }, {});
    console.log(rrres);*/
    return res;
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
    //console.log('getItemsStateAndParams::get actionParams');
    const actionParams = getItemsActionParams({config, itemsStateAndParams});
    const result: ItemsStateAndParams = Array.from(uniqIds).reduce(
        (acc: ItemsStateAndParams, id) => {
            const data = {} as ItemStateAndParams;
            if (id in params) {
                data.params = params[id];
            }
            if (id in state) {
                data.state = state[id];
            }
            if (id in actionParams) {
                data.actionParams = actionParams[id];
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
