import update, {extend, Spec, CustomCommands} from 'immutability-helper';
import Hashids from 'hashids';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import isEmpty from 'lodash/isEmpty';
import {
    mergeParamsWithAliases,
    isItemWithTabs,
    Config,
    ConfigItem,
    ItemsStateAndParams,
    ItemStateAndParams,
    ItemsStateAndParamsBase,
    StringParams,
    getCurrentVersion,
    META_KEY,
    deleteFromQueue,
    addToQueue,
    getInitialItemsStateAndParamsMeta,
    resolveItemInnerId,
    getItemsStateAndParamsMeta,
    getItemsActionParams,
    mergeParamsNamesWithPairAliases,
    hasActionParams,
    pickActionParamsFromParams,
    transformParamsToActionParams,
    ACTION_PARAM_PREFIX,
} from '../shared';
import {AddConfigItem, WidgetLayout} from '../typings';
import {RegisterManagerPluginLayout} from './register-manager';
import {DEFAULT_NAMESPACE} from '../constants';

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
    const stateParamsConf = isActionParamsMode
        ? pickActionParamsFromParams(stateAndParams.params, false)
        : stateAndParams.params;

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
    if (isActionParamsMode) {
        return paramsSettings?.returnPrefix
            ? transformParamsToActionParams(allowedParams)
            : allowedParams;
    }
    return allowedParams;
}

interface ChangeStateAndParamsArg {
    id: string;
    config: Config;
    itemsStateAndParams: ItemsStateAndParams;
    stateAndParams: ItemStateAndParams;
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

export class UpdateManager {
    // TODO: проверять, что id нового элемента уникальный
    static addItem({
        item,
        namespace = DEFAULT_NAMESPACE,
        layout,
        config,
    }: {
        item: AddConfigItem;
        namespace: string;
        layout: RegisterManagerPluginLayout;
        config: Config;
    }) {
        const layoutY = Math.max(0, ...config.layout.map(({h, y}) => h + y));
        const saveDefaultLayout = pick(layout, ['h', 'w', 'x', 'y']);

        const hashids = new Hashids(config.salt);
        let counter = config.counter;

        const resultData = isItemWithTabs(item)
            ? {
                  ...item.data,
                  tabs: item.data.tabs.map((tab) =>
                      tab.id ? tab : {...tab, id: hashids.encode(++counter)},
                  ),
              }
            : item.data;

        const newItem = {...item, id: hashids.encode(++counter), data: resultData, namespace};

        return update(config, {
            items: {$push: [newItem]},
            layout: {$push: [{...saveDefaultLayout, y: layoutY, i: newItem.id}]},
            counter: {$set: counter},
        });
    }

    static editItem({
        item,
        namespace = DEFAULT_NAMESPACE,
        config,
    }: {
        item: ConfigItem;
        namespace: string;
        config: Config;
    }) {
        const hashids = new Hashids(config.salt);
        let counter = config.counter;

        const itemIndex = config.items.findIndex(({id}) => item.id === id);

        const resultData = isItemWithTabs(item)
            ? {
                  ...item.data,
                  tabs: item.data.tabs.map((tab) =>
                      tab.id ? tab : {...tab, id: hashids.encode(++counter)},
                  ),
              }
            : item.data;

        return update(config, {
            items: {[itemIndex]: {$set: {...item, data: resultData, namespace}}},
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
    }: ChangeStateAndParamsArg): ItemsStateAndParams {
        if (getCurrentVersion(itemsStateAndParams) === 1) {
            return changeStateAndParamsVersion1({
                id: initiatorId,
                config,
                stateAndParams,
                itemsStateAndParams,
            });
        }
        const hasState = 'state' in stateAndParams;
        const {items, aliases} = config;
        const itemsIds = items.map(({id: itemId}) => itemId);
        const itemsStateAndParamsIds = Object.keys(omit(itemsStateAndParams, [META_KEY]));
        const unusedIds = itemsStateAndParamsIds.filter((id) => !itemsIds.includes(id));
        const initiatorItem = items.find(({id}) => id === initiatorId) as ConfigItem;
        const newTabId: string | undefined = stateAndParams.state?.tabId;
        const isTabSwitched = isItemWithTabs(initiatorItem) && Boolean(newTabId);
        const currentMeta = getItemsStateAndParamsMeta(itemsStateAndParams);
        const hasChangedActionParams = hasActionParams(stateAndParams);
        const actionParamsAll =
            getItemsActionParams({
                config,
                itemsStateAndParams,
            }) || {};
        const notEmptyActionParams = {} as Record<string, StringParams>;
        for (const [key, val] of Object.entries(actionParamsAll)) {
            if (!isEmpty(val)) {
                notEmptyActionParams[key] = val;
            }
        }

        if (hasChangedActionParams) {
            const allowableActionParams = getAllowableChangedParams(
                initiatorItem,
                stateAndParams,
                itemsStateAndParams,
                {type: 'actionParams', returnPrefix: true},
            );
            const actionParamsWithAliasesNames = {} as Record<string, Array<string>>;
            for (const [widgetIdKey, itemActionParams] of Object.entries(notEmptyActionParams)) {
                const aliasesNames: Array<Array<string>> = mergeParamsNamesWithPairAliases({
                    aliases,
                    namespace: initiatorItem.namespace,
                    paramsNames: Object.keys(itemActionParams),
                });
                actionParamsWithAliasesNames[widgetIdKey] = [];
                // remove all actionParams that is in aliasesNames
                if (aliasesNames.length) {
                    actionParamsWithAliasesNames[widgetIdKey] = [
                        ...actionParamsWithAliasesNames[widgetIdKey],
                        ...aliasesNames,
                    ] as Array<string>;
                }
            }

            const tabId: string | undefined = isItemWithTabs(initiatorItem)
                ? newTabId || resolveItemInnerId({item: initiatorItem, itemsStateAndParams})
                : undefined;
            const meta = addToQueue({id: initiatorId, tabId, config, itemsStateAndParams});

            const paramsFromStateAndParams =
                (itemsStateAndParams as ItemsStateAndParamsBase)?.[initiatorId]?.params || {};
            const newParams =
                !isEmpty(paramsFromStateAndParams) || !isEmpty(allowableActionParams)
                    ? {params: {...paramsFromStateAndParams, ...allowableActionParams}}
                    : {};
            const obj = {
                [initiatorId]: {
                    $set: {
                        ...newParams,
                        ...(hasState ? {state: {$set: stateAndParams.state}} : {}),
                    },
                },
                [META_KEY]: {$set: meta},
            };

            const res = update(itemsStateAndParams, obj);
            return res;
        } else if ('params' in stateAndParams) {
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

            const actionParamsWithAliasesNames = {} as Record<string, Array<string>>;
            for (const [widgetIdKey, itemActionParams] of Object.entries(notEmptyActionParams)) {
                const aliasesNames = mergeParamsNamesWithPairAliases({
                    aliases,
                    namespace: initiatorItem.namespace,
                    paramsNames: Object.keys(itemActionParams),
                });

                actionParamsWithAliasesNames[widgetIdKey] = [];
                // remove all actionParams that is in aliasesNames
                if (aliasesNames.length) {
                    actionParamsWithAliasesNames[widgetIdKey] = [
                        ...actionParamsWithAliasesNames[widgetIdKey],
                        ...aliasesNames,
                    ] as Array<string>;
                }
            }

            let actionParamsToClear = {} as Record<string, StringParams>;
            const actionParamsToDelete = {} as Record<string, StringParams>;
            Object.keys(allowableParams).forEach((paramName) => {
                for (const [widgetIdKey, itemActionParams] of Object.entries(
                    notEmptyActionParams,
                )) {
                    for (const [paramKey, paramVal] of Object.entries(itemActionParams)) {
                        const actionParamInAliases =
                            actionParamsWithAliasesNames[widgetIdKey].find((row) =>
                                row.includes(paramKey),
                            ) || ([] as Array<string>);

                        const hasAllowableParamInAliases = actionParamInAliases.includes(paramName);

                        if (
                            hasAllowableParamInAliases &&
                            notEmptyActionParams[widgetIdKey][paramKey]
                        ) {
                            if (!actionParamsToDelete[widgetIdKey]) {
                                actionParamsToDelete[widgetIdKey] = {};
                            }
                            actionParamsToDelete[widgetIdKey] = {
                                ...actionParamsToDelete[widgetIdKey],
                                [`${ACTION_PARAM_PREFIX}${paramKey}`]: paramVal,
                            };
                            delete notEmptyActionParams[widgetIdKey][paramKey];
                        }
                    }
                    actionParamsToClear = {
                        [widgetIdKey as string]: notEmptyActionParams[widgetIdKey],
                    };
                }
            });

            for (const [widgetIdKey, itemActionParams] of Object.entries(actionParamsToClear)) {
                const itemActionParamsWithPrefix = transformParamsToActionParams(itemActionParams);

                let updatingParams = {} as StringParams;
                if (
                    !isEmpty((itemsStateAndParams as ItemsStateAndParamsBase)[widgetIdKey]?.params)
                ) {
                    updatingParams = {
                        ...(itemsStateAndParams as ItemsStateAndParamsBase)[widgetIdKey].params,
                    };

                    if (!isEmpty(actionParamsToDelete)) {
                        Object.keys(actionParamsToDelete[widgetIdKey] || []).forEach(
                            (keyToDelete) => {
                                if (keyToDelete in updatingParams) {
                                    delete updatingParams[keyToDelete];
                                }
                            },
                        );
                    }
                }

                const newParamsWithClear = {
                    ...updatingParams,
                    ...itemActionParamsWithPrefix,
                } as StringParams;

                actionParamsToClear[widgetIdKey] = {
                    $set: {
                        params: newParamsWithClear,
                    },
                } as never;
            }
            const tabId: string | undefined = isItemWithTabs(initiatorItem)
                ? newTabId || resolveItemInnerId({item: initiatorItem, itemsStateAndParams})
                : undefined;
            const meta = addToQueue({id: initiatorId, tabId, config, itemsStateAndParams});
            let commandUpdateParams: string = (itemsStateAndParams as ItemsStateAndParamsBase)[
                initiatorId
            ]?.params
                ? '$merge'
                : '$set';
            if (isTabSwitched) {
                commandUpdateParams = '$set';
            }
            const actionParamsCommand = hasActionParams(
                (itemsStateAndParams as ItemsStateAndParamsBase)[initiatorId],
            )
                ? '$merge'
                : '$set';

            let setObj = null;
            if (commandUpdateParams === '$set' && actionParamsCommand === '$set') {
                setObj = {
                    params: {
                        ...allowableParams,
                        ...(hasChangedActionParams ? allowableActionParams : {}),
                    },
                };
            }

            const obj = {
                $unset: unusedIds,
                [initiatorId]: {
                    $auto: {
                        ...(setObj
                            ? {
                                  $set: setObj,
                              }
                            : {
                                  params: {
                                      [commandUpdateParams]: {
                                          ...allowableParams,
                                          ...allowableActionParams,
                                      },
                                  },
                              }),
                        ...(hasState ? {state: {$set: stateAndParams.state}} : {}),
                    },
                },
                ...actionParamsToClear,
                [META_KEY]: {$set: meta},
            };
            const res = update(itemsStateAndParams, obj);
            return res;
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
