import {META_KEY} from '../../constants';
import {
    Config,
    ConfigItem,
    ItemsStateAndParams,
    ItemsStateAndParamsBase,
    StringParams,
} from '../../types';
import {addGroupToQueue, addToQueue, formQueueData} from '../helpers';
import {getItemsParams, getItemsStateAndParams} from '../state-and-params';

const NAMESPACE = 'default';
const GROUP_CONTROL_TYPE = 'group-control';

const GLOBAL_ITEM_ID = 'globalItem1';
const REGULAR_ITEM_ID = 'regularItem1';
const GROUP_ITEM_ID = 'groupItem1';
const GROUP_ITEM_ID_2 = 'groupItem2';

const getMockedControlItem = (props?: {
    id: string;
    groupItemIds?: string[];
    defaults?: StringParams;
}): ConfigItem => {
    const {id = REGULAR_ITEM_ID, groupItemIds = [GROUP_ITEM_ID], defaults} = props || {};
    return {
        id,
        defaults,
        data: {
            group: groupItemIds.map((groupItemId) => ({
                id: groupItemId,
                namespace: NAMESPACE,
                defaults,
            })),
        },
        type: GROUP_CONTROL_TYPE,
        namespace: NAMESPACE,
    };
};

const getMockedConfig = ({
    items = [],
    globalItems = [],
}: {
    items?: ConfigItem[];
    globalItems?: ConfigItem[];
}): Config => ({
    items,
    globalItems,
    salt: '0.9021043992843898',
    counter: 124,
    layout: [],
    aliases: {},
    connections: [],
});

describe('globalItems functionality in config', () => {
    describe('addToQueue with globalItems', () => {
        it('should include globalItems when filtering actual IDs', () => {
            const globalItem = getMockedControlItem({id: GLOBAL_ITEM_ID});
            const regularItem = getMockedControlItem();
            const config = getMockedConfig({
                items: [regularItem],
                globalItems: [globalItem],
            });

            const itemsStateAndParams: ItemsStateAndParams = {
                [META_KEY]: {
                    queue: [{id: 'nonExistentItem'}, {id: GLOBAL_ITEM_ID}],
                    version: 2,
                },
            };

            const result = addToQueue({
                id: REGULAR_ITEM_ID,
                config,
                itemsStateAndParams,
            });

            // Should filter out non-existent items and add the new item
            expect(result.queue).toEqual([{id: GLOBAL_ITEM_ID}, {id: REGULAR_ITEM_ID}]);
        });

        it('should handle empty globalItems array', () => {
            const regularItem = getMockedControlItem();
            const config = getMockedConfig({
                items: [regularItem],
                globalItems: [],
            });

            const itemsStateAndParams: ItemsStateAndParams = {
                [META_KEY]: {
                    queue: [],
                    version: 2,
                },
            };

            const result = addToQueue({
                id: REGULAR_ITEM_ID,
                config,
                itemsStateAndParams,
            });

            expect(result.queue).toEqual([{id: REGULAR_ITEM_ID}]);
        });
    });

    describe('addGroupToQueue with globalItems', () => {
        it('should include globalItems when filtering actual IDs for group items', () => {
            const globalGroupItemId = 'globalGroupItem';
            const globalGroupSubItemId = 'globalGroupSubItem';
            const globalGroupSubItemId2 = 'globalGroupSubItem2';
            const globalGroupItem = getMockedControlItem({
                id: globalGroupItemId,
                groupItemIds: [globalGroupSubItemId, globalGroupSubItemId2],
            });
            const regularItem = getMockedControlItem();
            const config = getMockedConfig({
                items: [regularItem],
                globalItems: [globalGroupItem],
            });

            const itemsStateAndParams: ItemsStateAndParams = {
                [META_KEY]: {
                    queue: [
                        {id: globalGroupItemId, groupItemId: globalGroupSubItemId},
                        {id: 'nonExistentGroup', groupItemId: 'nonExistentSubItem'},
                    ],
                    version: 2,
                },
            };

            const result = addGroupToQueue({
                id: globalGroupItemId,
                groupItemIds: [globalGroupSubItemId2],
                config,
                itemsStateAndParams,
            });

            // Should preserve existing global group item and add new one
            expect(result.queue).toEqual([
                {id: globalGroupItemId, groupItemId: globalGroupSubItemId},
                {id: globalGroupItemId, groupItemId: globalGroupSubItemId2},
            ]);
        });
    });

    describe('formQueueData with globalItems', () => {
        it('should process globalItems in queue data formation', () => {
            const globalItem = getMockedControlItem({
                id: GLOBAL_ITEM_ID,
                groupItemIds: [GROUP_ITEM_ID],
                defaults: {
                    size: 'l',
                },
            });
            const regularItem = getMockedControlItem({
                id: REGULAR_ITEM_ID,
                groupItemIds: [GROUP_ITEM_ID_2],
                defaults: {view: 'normal'},
            });

            const itemsStateAndParams: ItemsStateAndParams = {
                [GLOBAL_ITEM_ID]: {
                    params: {
                        [GROUP_ITEM_ID]: {
                            size: 'xl',
                            color: 'red',
                        },
                    },
                },
                [REGULAR_ITEM_ID]: {
                    params: {
                        [GROUP_ITEM_ID_2]: {
                            view: 'contrast',
                        },
                    },
                },
                [META_KEY]: {
                    queue: [
                        {id: GLOBAL_ITEM_ID, groupItemId: GROUP_ITEM_ID},
                        {id: REGULAR_ITEM_ID, groupItemId: GROUP_ITEM_ID_2},
                    ],
                    version: 2,
                },
            };

            const result = formQueueData({
                items: [regularItem, globalItem],
                itemsStateAndParams,
            });

            expect(result).toEqual([
                {
                    id: GROUP_ITEM_ID,
                    namespace: NAMESPACE,
                    params: {size: 'xl'},
                },
                {
                    id: GROUP_ITEM_ID_2,
                    namespace: NAMESPACE,
                    params: {view: 'contrast'},
                },
            ]);
        });
    });

    describe('getItemsParams with globalItems', () => {
        it('should process globalItems when getting items parameters', () => {
            const globalParam = 'globalParam';
            const overriddenParam = 'overriddenValue';
            const regularParam = 'regularValue';
            const globalItem = getMockedControlItem({id: GLOBAL_ITEM_ID, defaults: {globalParam}});
            const regularItem = getMockedControlItem({
                id: REGULAR_ITEM_ID,
                groupItemIds: [GROUP_ITEM_ID_2],
                defaults: {
                    regularParam,
                },
            });

            const config = getMockedConfig({
                items: [regularItem],
                globalItems: [globalItem],
            });

            const itemsStateAndParams: ItemsStateAndParams = {
                [GLOBAL_ITEM_ID]: {
                    params: {
                        [GROUP_ITEM_ID]: {
                            globalParam: overriddenParam,
                        },
                    },
                },
                [META_KEY]: {
                    queue: [{id: GLOBAL_ITEM_ID, groupItemId: GROUP_ITEM_ID}],
                    version: 2,
                },
            };

            const result = getItemsParams({
                defaultGlobalParams: {},
                globalParams: {},
                config,
                itemsStateAndParams,
                plugins: [
                    {
                        type: GROUP_CONTROL_TYPE,
                    },
                ],
            });

            expect(result[GLOBAL_ITEM_ID]).toEqual({
                [GROUP_ITEM_ID]: {
                    globalParam: overriddenParam,
                    regularParam,
                },
            });
            expect(result[REGULAR_ITEM_ID]).toEqual({
                [GROUP_ITEM_ID_2]: {
                    globalParam: overriddenParam,
                    regularParam,
                },
            });
        });
    });

    describe('getItemsStateAndParams with globalItems', () => {
        it('should handle globalItems in state and params processing', () => {
            const initialValue = 'value';
            const globalParam = 'globalValue';
            const regularParam = 'regularValue';
            const globalState = 'globalStateValue';
            const regularState = 'regularStateValue';
            const globalItem = getMockedControlItem({
                id: GLOBAL_ITEM_ID,
                defaults: {globalDefault: initialValue},
            });
            const regularItem = getMockedControlItem({
                id: REGULAR_ITEM_ID,
                groupItemIds: [GROUP_ITEM_ID_2],
                defaults: {
                    regularDefault: initialValue,
                },
            });

            const config = getMockedConfig({
                items: [regularItem],
                globalItems: [globalItem],
            });

            // globalParam and regularParam are not included in conrols defaults so they must be ignored
            const itemsStateAndParams: ItemsStateAndParams = {
                [GLOBAL_ITEM_ID]: {
                    params: {globalParam},
                    state: {globalState},
                },
                [REGULAR_ITEM_ID]: {
                    params: {regularParam},
                    state: {regularState},
                },
                [META_KEY]: {
                    queue: [{id: GLOBAL_ITEM_ID}, {id: REGULAR_ITEM_ID}],
                    version: 2,
                },
            };

            const result = getItemsStateAndParams({
                defaultGlobalParams: {},
                globalParams: {},
                config,
                itemsStateAndParams,
                plugins: [
                    {
                        type: GROUP_CONTROL_TYPE,
                    },
                ],
            }) as ItemsStateAndParamsBase;

            expect(result[GLOBAL_ITEM_ID]).toEqual({
                params: {
                    [GROUP_ITEM_ID]: {
                        globalDefault: initialValue,
                        regularDefault: initialValue,
                    },
                },
                state: {globalState},
            });

            expect(result[REGULAR_ITEM_ID]).toEqual({
                params: {
                    [GROUP_ITEM_ID_2]: {
                        globalDefault: initialValue,
                        regularDefault: initialValue,
                    },
                },
                state: {regularState},
            });

            expect(result[META_KEY]).toEqual({
                queue: [{id: GLOBAL_ITEM_ID}, {id: REGULAR_ITEM_ID}],
                version: 2,
            });
        });

        it('should correctly handle config without globalItems', () => {
            const initialValue = 'value';
            const regularParam = 'regularValue';
            const regularState = 'regularStateValue';

            const regularItem = getMockedControlItem({
                id: REGULAR_ITEM_ID,
                defaults: {
                    regularParam: initialValue,
                },
            });

            const config = getMockedConfig({
                items: [regularItem],
                globalItems: undefined,
            });

            const itemsStateAndParams: ItemsStateAndParams = {
                [REGULAR_ITEM_ID]: {
                    params: {regularParam: initialValue},
                    state: {regularState},
                },
                [META_KEY]: {
                    queue: [{id: REGULAR_ITEM_ID, groupItemId: GROUP_ITEM_ID}],
                    version: 2,
                },
            };

            const result = getItemsStateAndParams({
                defaultGlobalParams: {},
                globalParams: {regularParam},
                config,
                itemsStateAndParams,
                plugins: [
                    {
                        type: GROUP_CONTROL_TYPE,
                    },
                ],
            }) as ItemsStateAndParamsBase;

            expect(result[REGULAR_ITEM_ID]).toEqual({
                params: {
                    [GROUP_ITEM_ID]: {
                        regularParam,
                    },
                },
                state: {regularState},
            });

            expect(result[META_KEY]).toEqual({
                queue: [{id: REGULAR_ITEM_ID, groupItemId: GROUP_ITEM_ID}],
                version: 2,
            });
        });
    });

    describe('edge cases with globalItems', () => {
        it('should handle config with only globalItems and no regular items', () => {
            const globalItemId1 = 'global1';
            const globalItemId2 = 'global2';
            const globalItem1 = getMockedControlItem({id: globalItemId1});
            const globalItem2 = getMockedControlItem({id: globalItemId2});

            const config = getMockedConfig({
                items: [],
                globalItems: [globalItem1, globalItem2],
            });

            const itemsStateAndParams: ItemsStateAndParams = {
                [META_KEY]: {
                    queue: [{id: globalItemId1}],
                    version: 2,
                },
            };

            const result = addToQueue({
                id: globalItemId2,
                config,
                itemsStateAndParams,
            });

            expect(result.queue).toEqual([{id: globalItemId1}, {id: globalItemId2}]);
        });
    });
});
