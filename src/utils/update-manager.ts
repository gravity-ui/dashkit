import update, {CustomCommands, Spec, extend} from 'immutability-helper';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import {DEFAULT_GROUP, DEFAULT_NAMESPACE} from '../constants';
import {
    ConfigLayout,
    META_KEY,
    addGroupToQueue,
    addToQueue,
    deleteFromQueue,
    getCurrentVersion,
    getInitialItemsStateAndParamsMeta,
    getItemsStateAndParamsMeta,
    isItemWithGroup,
    isItemWithTabs,
    mergeParamsWithAliases,
    pickActionParamsFromParams,
    resolveItemInnerId,
    transformParamsToActionParams,
} from '../shared';
import type {
    Config,
    ConfigItem,
    ConfigItemGroup,
    ConfigItemWithGroup,
    ItemStateAndParams,
    ItemStateAndParamsChangeOptions,
    ItemsStateAndParams,
    ItemsStateAndParamsBase,
    StateAndParamsMetaData,
    StringParams,
} from '../shared';
import type {
    AddConfigItem,
    AddNewItemOptions,
    ReflowLayoutOptions,
    SetItemOptions,
    WidgetLayout,
} from '../typings';

import {getNewId} from './get-new-id';
import {bottom, compact} from './grid-layout';
import {resolveLayoutGroup} from './group-helpers';
import {RegisterManagerPluginLayout} from './register-manager';

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
        .reduce(
            (acc, key) => {
                const {params} = (itemsStateAndParams as ItemsStateAndParamsBase)[key];
                // в state из урла могут быть элементы, которых нет в config.items
                const item = config.items.find((configItem) => configItem.id === key);
                if (params && item) {
                    const {namespace} = item;
                    const currentUniqParamsKeys =
                        namespace === removeItem.namespace
                            ? uniqNamespaceParamsKeys
                            : uniqParamsKeys;
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
            },
            {} as Record<string, Spec<{params: StringParams}>>,
        );
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
    item: ConfigItem | ConfigItemGroup,
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

    // check if structure is StringParams or Record<string, StringParams>
    // if it's Record<string, StringParams>, then this is a group application of params
    // and checking for comparison of allowedParams and stateParamsConf is not necessary
    const isGroupParamsApply =
        typeof stateParamsConf?.[item.id] === 'object' &&
        stateParamsConf?.[item.id] !== null &&
        !Array.isArray(stateParamsConf?.[item.id]);

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
        const paramsConf = isGroupParamsApply ? stateParamsConf[item.id] : stateParamsConf;
        allowedParams = pick(paramsConf, Object.keys(item.defaults || {})) as StringParams;
    }

    if (
        !isGroupParamsApply &&
        Object.keys(allowedParams || {}).length !== Object.keys(stateParamsConf || {}).length
    ) {
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
            updateIds.reduce(
                (acc, currentId) => {
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
                },
                {} as Record<string, Spec<ItemsStateAndParams, AutoExtendCommand>>,
            ),
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

    if (isItemWithGroup(item)) {
        const group = item.data.group.map((groupItem) => {
            if (groupItem.id) {
                return groupItem;
            }

            const newIdGroupData = getNewId({config, salt, counter, excludeIds});
            counter = newIdGroupData.counter;
            excludeIds.push(newIdGroupData.id);

            return {
                ...groupItem,
                id: newIdGroupData.id,
                namespace: groupItem.namespace || DEFAULT_NAMESPACE,
            };
        });

        data = {...item.data, group};
    }

    return {data, counter, excludeIds};
}

export const getChangedParams = ({
    initiatorItem,
    stateAndParams,
    itemsStateAndParams,
}: {
    initiatorItem: ConfigItem | ConfigItemGroup;
    stateAndParams: ItemStateAndParams;
    itemsStateAndParams: ItemsStateAndParams;
}) => {
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

    return {...allowableParams, ...allowableActionParams};
};

function changeGroupParams({
    groupItemIds,
    initiatorId,
    initiatorItem,
    itemsStateAndParams,
    stateAndParams,
    config,
    unusedIds,
}: {
    groupItemIds: string[];
    initiatorId: string;
    initiatorItem: ConfigItemWithGroup;
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
    stateAndParams: ItemStateAndParams;
    unusedIds: string[];
}) {
    const meta: StateAndParamsMetaData = addGroupToQueue({
        id: initiatorId,
        groupItemIds,
        config,
        itemsStateAndParams,
    });
    const updatedItems: Record<string, StringParams> = {};
    const currentItemParams = (itemsStateAndParams as ItemsStateAndParamsBase)[initiatorId]
        ?.params as Record<string, StringParams> | undefined;

    for (const groupItem of initiatorItem.data.group) {
        if (groupItemIds.includes(groupItem.id)) {
            const changedParams = getChangedParams({
                initiatorItem: groupItem,
                stateAndParams,
                itemsStateAndParams,
            });

            updatedItems[groupItem.id] = changedParams;

            continue;
        }

        if (currentItemParams && currentItemParams[groupItem.id]) {
            updatedItems[groupItem.id] = currentItemParams[groupItem.id];
        }
    }

    const obj = {
        $unset: unusedIds,
        [initiatorId]: {
            $auto: {
                params: {
                    $set: updatedItems,
                },
            },
        },
        [META_KEY]: {$set: meta},
    };
    return update(itemsStateAndParams, obj);
}

export function reflowLayout({
    newLayoutItem,
    layout,
    reflowLayoutOptions,
}: {
    newLayoutItem?: ConfigLayout;
    layout: ConfigLayout[];
    reflowLayoutOptions: ReflowLayoutOptions;
}) {
    const byGroup: Record<string, ConfigLayout[]> = {};
    const reducer = (
        memo: Record<string, number>,
        item: ConfigLayout,
        i: number,
        _items: ConfigLayout[],
        isNewItem?: boolean,
    ) => {
        memo[item.i] = i;
        const parent = resolveLayoutGroup(item);

        if (byGroup[parent]) {
            if (isNewItem) {
                byGroup[parent].unshift(item);
            } else {
                byGroup[parent].push(item);
            }
        } else {
            byGroup[parent] = [item];
        }

        return memo;
    };

    const orderById = layout.reduce<Record<string, number>>(reducer, {});

    if (newLayoutItem) {
        reducer(orderById, newLayoutItem, layout.length, layout, true);
    }

    const {defaultProps} = reflowLayoutOptions;

    return Object.entries(byGroup)
        .reduce<ConfigLayout[]>((memo, [groupId, layoutItems]) => {
            let reflowOptions = defaultProps;
            if (reflowLayoutOptions?.groups?.[groupId]) {
                reflowOptions = reflowLayoutOptions?.groups[groupId];
            }

            if (reflowOptions.compactType === null) {
                return memo.concat(layoutItems);
            }

            const compactedList = compact(
                layoutItems,
                reflowOptions.compactType,
                reflowOptions.cols,
            ).map((item) => {
                const cleanCopy = pick(item, ['i', 'h', 'w', 'x', 'y', 'parent']) as ConfigLayout;

                if (groupId === DEFAULT_GROUP) {
                    return cleanCopy;
                }

                return {...cleanCopy, parent: groupId};
            });

            return memo.concat(compactedList);
        }, [])
        .sort((a, b) => orderById[a.i] - orderById[b.i]);
}

export class UpdateManager {
    static addItem({
        item,
        namespace = DEFAULT_NAMESPACE,
        layout,
        config,
        options = {},
    }: {
        item: AddConfigItem;
        namespace: string;
        layout: RegisterManagerPluginLayout;
        config: Config;
        options?: AddNewItemOptions;
    }) {
        const salt = config.salt;

        const newItemData = getNewItemData({item, config, salt, counter: config.counter, options});
        let counter = newItemData.counter;

        const newIdData = getNewId({config, salt, counter, excludeIds: newItemData.excludeIds});
        counter = newIdData.counter;

        const newItem = {...item, id: newIdData.id, data: newItemData.data, namespace};
        const saveDefaultLayout = pick(layout, ['h', 'w', 'x', 'y', 'parent']);

        if (options.updateLayout) {
            const byId = options.updateLayout.reduce<Record<string, ConfigLayout>>((memo, t) => {
                memo[t.i] = t;
                return memo;
            }, {});
            let newLayout;
            const newLayoutItem = {...saveDefaultLayout, i: newItem.id};

            if (options.reflowLayoutOptions) {
                newLayout = reflowLayout({
                    newLayoutItem,
                    layout: config.layout.map((t) => ({...t, ...(byId[t.i] || {})})),
                    reflowLayoutOptions: options.reflowLayoutOptions,
                });
            } else {
                newLayout = [
                    ...config.layout.map((t) => ({...t, ...(byId[t.i] || {})})),
                    {...saveDefaultLayout, i: newItem.id},
                ];
            }

            return update(config, {
                items: {$push: [newItem]},
                layout: {$set: newLayout},
                counter: {$set: counter},
            });
        } else if (isFinite(layout.y)) {
            let newLayout;
            const newLayoutItem = {...saveDefaultLayout, i: newItem.id};

            if (options.reflowLayoutOptions) {
                newLayout = reflowLayout({
                    newLayoutItem,
                    layout: config.layout,
                    reflowLayoutOptions: options.reflowLayoutOptions,
                });
            } else {
                newLayout = [...config.layout, newLayoutItem];
            }

            return update(config, {
                items: {$push: [newItem]},
                layout: {$set: newLayout},
                counter: {$set: counter},
            });
        } else {
            const layoutY = bottom(config.layout);
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
        options = {},
    }: {
        item: ConfigItem;
        namespace: string;
        config: Config;
        options?: SetItemOptions;
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
        const layoutIndex = config.layout.findIndex((item) => item.i === id);
        const item = config.items[itemIndex];
        let itemIds = [id];
        if (isItemWithTabs(item)) {
            itemIds = [id].concat(item.data.tabs.map((tab) => tab.id));
        }
        if (isItemWithGroup(item)) {
            itemIds = [id].concat(item.data.group.map((groupItem) => groupItem.id));
        }
        const connections = config.connections.filter(
            ({from, to}) => !itemIds.includes(from) && !itemIds.includes(to),
        );
        return {
            config: update(config, {
                items: {
                    $splice: [[itemIndex, 1]],
                },
                layout: {
                    $splice: [[layoutIndex, 1]],
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
                $set: layout.map((item) => pick(item, ['i', 'h', 'w', 'x', 'y', 'parent'])),
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
        const groupItemIds = options?.groupItemIds;

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

        if (isItemWithGroup(initiatorItem) && groupItemIds) {
            return changeGroupParams({
                initiatorId,
                initiatorItem,
                groupItemIds,
                itemsStateAndParams,
                stateAndParams,
                config,
                unusedIds,
            });
        }

        if ('params' in stateAndParams) {
            const changedParams = getChangedParams({
                initiatorItem,
                stateAndParams,
                itemsStateAndParams,
            });

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
                            [commandUpdateParams]: changedParams,
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
