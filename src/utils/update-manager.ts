import update, {extend, Spec, CustomCommands} from 'immutability-helper';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import {
    mergeParamsWithAliases,
    isItemWithTabs,
    Config,
    ConfigItem,
    ItemsStateAndParams,
    ItemStateAndParams,
    ItemsStateAndParamsBase,
    ItemStateAndParamsChangeOptions,
    StringParams,
    getCurrentVersion,
    META_KEY,
    deleteFromQueue,
    addToQueue,
    getInitialItemsStateAndParamsMeta,
    resolveItemInnerId,
    getItemsStateAndParamsMeta,
    pickActionParamsFromParams,
    transformParamsToActionParams,
    ConfigLayout,
} from '../shared';
import {AddConfigItem, WidgetLayout, SetItemOptions, SetNewItemOptions} from '../typings';
import {RegisterManagerPluginLayout} from './register-manager';
import {DEFAULT_NAMESPACE} from '../constants';
import {getNewId} from './get-new-id';

extend('$auto', (value, object) => (object ? update(object, value) : update({}, value)));
type AutoExtendCommand = CustomCommands<{$auto: object}>;

interface RemoveItemArg {
    id: string;
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
}

function removeItemVersion1({id, config, itemsStateAndParams}: RemoveItemArg) {
    const itemIndex = config.items.findIndex((item) => item.id === id);
    const removeItem = config.items[itemIndex];
    const {defaults = {}} = removeItem;
    const itemParamsKeys = Object.keys(defaults);
    const getParams = (excludeId: string, items: ConfigItem[]) => {
        return Object.keys(
            items.reduce((acc: StringParams, item) => {
                if (item.id !== excludeId) {
                    Object.assign(acc, item.defaults);
                }
                return acc;
            }, {}),
        );
    };
    const allParamsKeys = getParams(id, config.items);
    const allNamespaceParamsKeys = getParams(
        id,
        config.items.filter((item) => item.namespace === removeItem.namespace),
    );
    const uniqParamsKeys = itemParamsKeys.filter((key) => !allParamsKeys.includes(key));
    const uniqNamespaceParamsKeys = itemParamsKeys.filter(
        (key) => !allNamespaceParamsKeys.includes(key),
    );
    const withoutUniqItemsParams = Object.keys(itemsStateAndParams)
        .filter((key) => key !== id)
        .reduce((acc, key) => {
            const {params} = (itemsStateAndParams as ItemsStateAndParamsBase)[key];
            // в state из урла могут быть элементы, которых нет в config.items
            const item = config.items.find((configItem) => configItem.id === key);
            if (params && item) {
                const {namespace} = item;
                const currentUniqParamsKeys =
                    namespace === removeItem.namespace ? uniqNamespaceParamsKeys : uniqParamsKeys;
                const resultParams: StringParams = omit(params, currentUniqParamsKeys);
                if (Object.keys(params).length !== Object.keys(resultParams).length) {
                    acc[key] = {
                        params: {
                            $set: resultParams,
                        },
                    };
                }
            }
            return acc;
        }, {} as Record<string, Spec<{params: StringParams}>>);
    const newItemsStateAndParams = update(itemsStateAndParams, {
        $unset: [id],
        ...withoutUniqItemsParams,
    });
    const connections = config.connections.filter(({from, to}) => id !== from && id !== to);
    const newConfig = update(config, {
        items: {
            $splice: [[itemIndex, 1]],
        },
        layout: {
            $splice: [[itemIndex, 1]],
        },
        connections: {
            $set: connections,
        },
    });
    return {
        config: newConfig,
        itemsStateAndParams: newItemsStateAndParams,
    };
}

function getAllowableChangedParams(
    item: ConfigItem,
    stateAndParams: ItemStateAndParams,
    itemsStateAndParams: ItemsStateAndParams,
    paramsSettings?: {
        type?: 'params' | 'actionParams';
        returnPrefix: boolean;
    },
): StringParams {
    const paramsTypeName = paramsSettings?.type || 'params';
    const isActionParamsMode = paramsTypeName === 'actionParams';

    let allowedParams: StringParams = {};
    if (isActionParamsMode) {
        allowedParams = pickActionParamsFromParams(stateAndParams.params, false);
        return paramsSettings?.returnPrefix
            ? transformParamsToActionParams(allowedParams)
            : allowedParams;
    }

    const stateParamsConf = stateAndParams.params;

    if (isItemWithTabs(item)) {
        let tab;
        if ('state' in stateAndParams && stateAndParams.state?.tabId) {
            tab = item.data.tabs.find(({id}) => id === stateAndParams.state?.tabId);
        }
        if (!tab) {
            const tabId = resolveItemInnerId({item, itemsStateAndParams});
            tab = item.data.tabs.find(({id}) => id === tabId);
        }
        allowedParams = pick(stateParamsConf, Object.keys(tab?.params || {})) as StringParams;
    } else {
        allowedParams = pick(stateParamsConf, Object.keys(item.defaults || {})) as StringParams;
    }
    if (Object.keys(allowedParams || {}).length !== Object.keys(stateParamsConf || {}).length) {
        console.warn('Параметры, которых нет в defaults, будут проигнорированы!');
    }
    return allowedParams;
}

interface ChangeStateAndParamsArg {
    id: string;
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
    stateAndParams: ItemStateAndParams;
    options?: ItemStateAndParamsChangeOptions;
}

function changeStateAndParamsVersion1({
    id: initiatorId,
    config,
    stateAndParams,
    itemsStateAndParams,
}: ChangeStateAndParamsArg) {
    const hasState = 'state' in stateAndParams;
    const {aliases} = config;
    if ('params' in stateAndParams) {
        const initiatorItem = config.items.find(({id}) => id === initiatorId) as ConfigItem;
        const allowableParams = getAllowableChangedParams(
            initiatorItem,
            stateAndParams,
            itemsStateAndParams,
        );
        const allowableParamsWithAliases = mergeParamsWithAliases({
            aliases,
            namespace: initiatorItem.namespace,
            params: allowableParams,
        });
        const ignoresInitiatorIds = config.connections
            .filter(({to}) => to === initiatorId)
            .map(({from}) => from);
        const updateIds = config.items
            .filter(
                (item) =>
                    item.namespace === initiatorItem.namespace &&
                    !ignoresInitiatorIds.includes(item.id) &&
                    (!isItemWithTabs(item) ||
                        (isItemWithTabs(item) &&
                            item.data.tabs.every(({id}) => !ignoresInitiatorIds.includes(id)))),
            )
            .map(({id}) => id);
        return update(
            itemsStateAndParams,
            updateIds.reduce((acc, currentId) => {
                acc[currentId] = {
                    $auto: {
                        params: {
                            [(itemsStateAndParams as ItemsStateAndParamsBase)[currentId]?.params
                                ? '$merge'
                                : '$set']: allowableParamsWithAliases,
                        },
                        ...(hasState && currentId === initiatorId
                            ? {state: {$set: stateAndParams.state}}
                            : {}),
                    },
                };
                return acc;
            }, {} as Record<string, Spec<ItemsStateAndParams, AutoExtendCommand>>),
        );
    } else if (hasState) {
        return update(itemsStateAndParams, {
            [initiatorId]: {
                $auto: {
                    state: {$set: stateAndParams.state},
                },
            },
        });
    } else {
        return itemsStateAndParams;
    }
}

type GetNewItemDataArgs = {
    item: AddConfigItem | ConfigItem;
    config: Config;
    salt: Config['salt'];
    counter: Config['counter'];
    options: SetItemOptions;
};

function getNewItemData({item, config, counter: argsCounter, salt, options}: GetNewItemDataArgs) {
    const excludeIds = [...(options.excludeIds || [])];
    let counter = argsCounter;

    let data = item.data;

    if (isItemWithTabs(item)) {
        const tabs = item.data.tabs.map((tab) => {
            if (tab.id) {
                return tab;
            }

            const newIdTabData = getNewId({config, salt, counter, excludeIds});
            counter = newIdTabData.counter;
            excludeIds.push(newIdTabData.id);

            return {...tab, id: newIdTabData.id};
        });

        data = {...item.data, tabs};
    }
    return {data, counter, excludeIds};
}

export class UpdateManager {
    static addItem({
        item,
        namespace = DEFAULT_NAMESPACE,
        layout,
        config,
        options,
    }: {
        item: AddConfigItem;
        namespace: string;
        layout: RegisterManagerPluginLayout;
        config: Config;
        options: SetNewItemOptions;
    }) {
        const salt = config.salt;

        const newItemData = getNewItemData({item, config, salt, counter: config.counter, options});
        let counter = newItemData.counter;

        const newIdData = getNewId({config, salt, counter, excludeIds: newItemData.excludeIds});
        counter = newIdData.counter;

        const newItem = {...item, id: newIdData.id, data: newItemData.data, namespace};
        const saveDefaultLayout = pick(layout, ['h', 'w', 'x', 'y']);

        if (options.updateLayout) {
            const byId = options.updateLayout.reduce<Record<string, ConfigLayout>>((memo, t) => {
                memo[t.i] = t;
                return memo;
            }, {});
            const newLayout = [
                ...config.layout.map((t) => ({...t, ...(byId[t.i] || {})})),
                {...saveDefaultLayout, i: newItem.id},
            ];

            return update(config, {
                items: {$push: [newItem]},
                layout: {$set: newLayout},
                counter: {$set: counter},
            });
        } else {
            const layoutY = Math.max(0, ...config.layout.map(({h, y}) => h + y));
            const newLayoutItem = {...saveDefaultLayout, y: layoutY, i: newItem.id};

            return update(config, {
                items: {$push: [newItem]},
                layout: {$push: [newLayoutItem]},
                counter: {$set: counter},
            });
        }
    }

    static editItem({
        item,
        namespace = DEFAULT_NAMESPACE,
        config,
        options,
    }: {
        item: ConfigItem;
        namespace: string;
        config: Config;
        options: SetItemOptions;
    }) {
        const itemIndex = config.items.findIndex(({id}) => item.id === id);

        const {counter, data} = getNewItemData({
            item,
            config,
            salt: config.salt,
            counter: config.counter,
            options,
        });

        return update(config, {
            items: {[itemIndex]: {$set: {...item, data, namespace}}},
            counter: {$set: counter},
        });
    }

    static removeItem({id, config, itemsStateAndParams = {}}: RemoveItemArg): {
        config: Config;
        itemsStateAndParams: ItemsStateAndParams;
    } {
        if (getCurrentVersion(itemsStateAndParams) === 1) {
            return removeItemVersion1({id, config, itemsStateAndParams});
        }
        const itemIndex = config.items.findIndex((item) => item.id === id);
        const item = config.items[itemIndex];
        const itemIds = isItemWithTabs(item)
            ? [id].concat(item.data.tabs.map((tab) => tab.id))
            : [id];
        const connections = config.connections.filter(
            ({from, to}) => !itemIds.includes(from) && !itemIds.includes(to),
        );
        return {
            config: update(config, {
                items: {
                    $splice: [[itemIndex, 1]],
                },
                layout: {
                    $splice: [[itemIndex, 1]],
                },
                connections: {
                    $set: connections,
                },
            }),
            itemsStateAndParams: update(itemsStateAndParams, {
                $unset: [id],
                [META_KEY]: {
                    $set: deleteFromQueue({
                        id,
                        itemsStateAndParams,
                        config,
                    }),
                },
            }),
        };
    }

    static updateLayout({layout, config}: {layout: WidgetLayout[]; config: Config}) {
        return update(config, {
            layout: {
                $set: layout.map(({x, y, w, h, i}) => ({x, y, w, h, i})),
            },
        });
    }

    static changeStateAndParams({
        id: initiatorId,
        config,
        stateAndParams,
        itemsStateAndParams,
        options,
    }: ChangeStateAndParamsArg): ItemsStateAndParams {
        if (getCurrentVersion(itemsStateAndParams) === 1) {
            return changeStateAndParamsVersion1({
                id: initiatorId,
                config,
                stateAndParams,
                itemsStateAndParams,
            });
        }

        const action = options?.action;
        const hasState = 'state' in stateAndParams;
        const {items} = config;
        const itemsIds = items.map(({id: itemId}) => itemId);
        const itemsStateAndParamsIds = Object.keys(omit(itemsStateAndParams, [META_KEY]));
        const unusedIds = itemsStateAndParamsIds.filter((id) => !itemsIds.includes(id));
        const initiatorItem = items.find(({id}) => id === initiatorId) as ConfigItem;
        const newTabId: string | undefined = stateAndParams.state?.tabId;
        const isTabSwitched = isItemWithTabs(initiatorItem) && Boolean(newTabId);
        const currentMeta = getItemsStateAndParamsMeta(itemsStateAndParams);

        if (action === 'removeItem') {
            return update(itemsStateAndParams, {
                $unset: [...unusedIds, initiatorId],
                [META_KEY]: {
                    $set: currentMeta
                        ? deleteFromQueue({
                              id: initiatorId,
                              itemsStateAndParams,
                              config,
                          })
                        : getInitialItemsStateAndParamsMeta(),
                },
            });
        }

        if ('params' in stateAndParams) {
            const allowableParams = getAllowableChangedParams(
                initiatorItem,
                stateAndParams,
                itemsStateAndParams,
            );

            const allowableActionParams = getAllowableChangedParams(
                initiatorItem,
                stateAndParams,
                itemsStateAndParams,
                {type: 'actionParams', returnPrefix: true},
            );

            const tabId: string | undefined = isItemWithTabs(initiatorItem)
                ? newTabId || resolveItemInnerId({item: initiatorItem, itemsStateAndParams})
                : undefined;
            const meta = addToQueue({id: initiatorId, tabId, config, itemsStateAndParams});
            let commandUpdateParams: string = (itemsStateAndParams as ItemsStateAndParamsBase)[
                initiatorId
            ]?.params
                ? '$merge'
                : '$set';
            if (isTabSwitched || action === 'setParams') {
                commandUpdateParams = '$set';
            }

            const obj = {
                $unset: unusedIds,
                [initiatorId]: {
                    $auto: {
                        params: {
                            [commandUpdateParams]: {
                                ...allowableParams,
                                ...allowableActionParams,
                            },
                        },
                        ...(hasState ? {state: {$set: stateAndParams.state}} : {}),
                    },
                },
                [META_KEY]: {$set: meta},
            };
            return update(itemsStateAndParams, obj);
        } else if (hasState) {
            let metaSpec: Spec<ItemsStateAndParams> = {};
            if (currentMeta && isTabSwitched) {
                metaSpec = {
                    [META_KEY]: {
                        $set: deleteFromQueue({
                            id: initiatorId,
                            itemsStateAndParams,
                            config,
                        }),
                    },
                };
            }
            return update(itemsStateAndParams, {
                $unset: unusedIds,
                [initiatorId]: {
                    $auto: {
                        state: {$set: stateAndParams.state},
                        ...(isTabSwitched ? {$unset: ['params']} : {}),
                    },
                },
                ...(currentMeta
                    ? metaSpec
                    : {[META_KEY]: {$set: getInitialItemsStateAndParamsMeta()}}),
            });
        } else {
            return update(itemsStateAndParams, {
                $unset: unusedIds,
                ...(currentMeta
                    ? {}
                    : {
                          [META_KEY]: {$set: getInitialItemsStateAndParamsMeta()},
                      }),
            });
        }
    }
}
