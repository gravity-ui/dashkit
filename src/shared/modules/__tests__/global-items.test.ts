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
const GLOBAL_ITEM_ID = 'globalItem1';
const REGULAR_ITEM_ID = 'regularItem1';
const GROUP_ITEM_ID = 'groupItem1';

const getMockedGlobalItem = (id: string = GLOBAL_ITEM_ID, defaults?: StringParams): ConfigItem => ({
    id,
    defaults,
    data: {},
    type: 'control',
    namespace: NAMESPACE,
});

const getMockedRegularItem = (
    id: string = REGULAR_ITEM_ID,
    defaults?: StringParams,
): ConfigItem => ({
    id,
    defaults,
    data: {},
    type: 'control',
    namespace: NAMESPACE,
});

const getMockedGroupItem = (
    id: string,
    groupItemIds: string[] = [GROUP_ITEM_ID],
    defaults?: StringParams,
): ConfigItem => ({
    id,
    data: {
        group: groupItemIds.map((groupItemId) => ({
            id: groupItemId,
            namespace: NAMESPACE,
            defaults,
        })),
    },
    type: 'group-control',
    namespace: NAMESPACE,
});

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
            const globalItem = getMockedGlobalItem();
            const regularItem = getMockedRegularItem();
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
            const regularItem = getMockedRegularItem();
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
            const globalGroupItem = getMockedGroupItem(globalGroupItemId, [
                globalGroupSubItemId,
                globalGroupSubItemId2,
            ]);
            const regularItem = getMockedRegularItem();
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
            const globalItem = getMockedGroupItem(GLOBAL_ITEM_ID, [GROUP_ITEM_ID], {
                size: 'l',
            });
            const regularItem = getMockedRegularItem(REGULAR_ITEM_ID, {view: 'normal'});

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
                        view: 'contrast',
                    },
                },
                [META_KEY]: {
                    queue: [
                        {id: GLOBAL_ITEM_ID, groupItemId: GROUP_ITEM_ID},
                        {id: REGULAR_ITEM_ID},
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
                    id: REGULAR_ITEM_ID,
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
            const globalItem = getMockedGlobalItem(GLOBAL_ITEM_ID, {globalParam});
            const regularItem = getMockedRegularItem(REGULAR_ITEM_ID, {
                regularParam,
            });

            const config = getMockedConfig({
                items: [regularItem],
                globalItems: [globalItem],
            });

            const itemsStateAndParams: ItemsStateAndParams = {
                [GLOBAL_ITEM_ID]: {
                    params: {globalParam: overriddenParam},
                },
                [META_KEY]: {
                    queue: [{id: GLOBAL_ITEM_ID}],
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
                        type: 'control',
                    },
                ],
            });

            expect(result[GLOBAL_ITEM_ID]).toEqual({
                globalParam: overriddenParam,
                regularParam,
            });
            expect(result[REGULAR_ITEM_ID]).toEqual({
                globalParam: overriddenParam,
                regularParam,
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
            const globalItem = getMockedGlobalItem(GLOBAL_ITEM_ID, {globalDefault: initialValue});
            const regularItem = getMockedRegularItem(REGULAR_ITEM_ID, {
                regularDefault: initialValue,
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
                        type: 'control',
                    },
                    {
                        type: 'group-control',
                    },
                ],
            }) as ItemsStateAndParamsBase;

            expect(result[GLOBAL_ITEM_ID]).toEqual({
                params: {
                    globalDefault: initialValue,
                    regularDefault: initialValue,
                },
                state: {globalState},
            });

            expect(result[REGULAR_ITEM_ID]).toEqual({
                params: {
                    globalDefault: initialValue,
                    regularDefault: initialValue,
                },
                state: {regularState},
            });

            expect(result[META_KEY]).toEqual({
                queue: [{id: GLOBAL_ITEM_ID}, {id: REGULAR_ITEM_ID}],
                version: 2,
            });
        });
    });

    describe('edge cases with globalItems', () => {
        it('should handle config with only globalItems and no regular items', () => {
            const globalItemId1 = 'global1';
            const globalItemId2 = 'global2';
            const globalItem1 = getMockedGlobalItem(globalItemId1);
            const globalItem2 = getMockedGlobalItem(globalItemId2);

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
