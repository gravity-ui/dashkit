import {ACTION_PARAM_PREFIX, META_KEY} from '../../constants';
import {
    Config,
    ConfigItem,
    ConfigItemData,
    ConfigItemWithGroup,
    ItemsStateAndParams,
    StringParams,
} from '../../types';
import {
    addGroupToQueue,
    addToQueue,
    formQueueData,
    hasActionParams,
    pickExceptActionParamsFromParams,
    transformParamsToActionParams,
} from '../helpers';

const DEFAULT_CONTROL_ID = 'controlId';
const DEFAULT_CONTROL_ID_2 = 'controlId2';
const DEFAULT_GROUP_ITEM_ID = 'groupItemId';
const DEFAULT_GROUP_ITEM_ID_2 = 'groupItemId2';
const DEFAULT_WIDGET_ID = 'widgetId';
const DEFAULT_WIDGET_TAB_ID = 'widget_tabId';
const NAMESPACE = 'default';

type MockedControlItemArgs = {
    defaults?: StringParams;
    id?: string;
};

type MockedGroupControlItemArgs = MockedControlItemArgs & {
    groupItemId?: string;
    groupItemId2?: string;
};

const getMockedControlItem = ({
    id = DEFAULT_CONTROL_ID,
    defaults,
}: MockedControlItemArgs): ConfigItem => ({
    id,
    defaults,
    data: {},
    type: 'control',
    namespace: NAMESPACE,
});

const getMockedGroupControlItem = ({
    id = DEFAULT_CONTROL_ID,
    groupItemId = DEFAULT_GROUP_ITEM_ID,
    groupItemId2 = DEFAULT_GROUP_ITEM_ID_2,
    defaults,
}: MockedGroupControlItemArgs): ConfigItemWithGroup => ({
    id,
    data: {
        group: [
            {id: groupItemId, namespace: NAMESPACE, defaults},
            {id: groupItemId2, namespace: NAMESPACE, defaults},
        ],
    },
    type: 'group-control',
    namespace: NAMESPACE,
});

type MockedWidgetItemArgs = {
    id?: string;
    tabs?: ConfigItemData['tabs'];
};

const getMockedConfig = ({items}: {items: ConfigItem[]}): Config => ({
    items,
    salt: '0.9021043992843898',
    counter: 124,
    layout: [],
    aliases: {},
    connections: [],
});

const stateAndParamsWithParamsOnly = {
    params: {
        paramName: 'param1',
    },
};

const stateAndParamsWithStateOnly = {
    state: {
        tabId: 'tabId1',
    },
};

const stateAndParamsWithActionParamsInParamsOnly = {
    params: {
        _ap_paramName: 'param1',
    },
};

const stateAndParamsWithStateAndActionParamsInParams = {
    state: {
        tabId: 'tabId1',
    },
    params: {
        _ap_paramName: 'param1',
    },
};

const stateAndParamsWithParamsAndActionParamsInParams = {
    params: {
        paramName2: 'param2',
        _ap_paramName: 'param1',
    },
};

const paramsToTransform = {
    in: {
        param1: 'val 1',
        param2: 'val 2',
    },
    out: {
        [`${ACTION_PARAM_PREFIX}param1`]: 'val 1',
        [`${ACTION_PARAM_PREFIX}param2`]: 'val 2',
    },
};

const exeptActionParam1 = {
    in: stateAndParamsWithParamsOnly.params,
    out: stateAndParamsWithParamsOnly.params,
};
const exeptActionParam2 = {
    in: stateAndParamsWithActionParamsInParamsOnly.params,
    out: {},
};
const exeptActionParam3 = {
    in: stateAndParamsWithParamsAndActionParamsInParams.params,
    out: {
        paramName2: 'param2',
    },
};

const getMockedWidgetItem = ({id = DEFAULT_WIDGET_ID, tabs}: MockedWidgetItemArgs): ConfigItem => ({
    id,
    data: {tabs},
    type: 'widget',
    namespace: NAMESPACE,
});

describe('modules.helpers', () => {
    describe('formQueueData', () => {
        it('return correct queue data for control: common', () => {
            const itemsStateAndParams: ItemsStateAndParams = {
                [DEFAULT_CONTROL_ID]: {
                    params: {
                        scale: 'd',
                        view: 'normal',
                    },
                },
                [META_KEY]: {
                    queue: [{id: DEFAULT_CONTROL_ID}],
                    version: 2,
                },
            };

            const controlItem1 = getMockedControlItem({id: 'control-1'});
            expect([]).toEqual(formQueueData({items: [controlItem1], itemsStateAndParams}));

            const controlItem2 = getMockedControlItem({id: 'control-2', defaults: {scale: 'm'}});
            expect([]).toEqual(formQueueData({items: [controlItem2], itemsStateAndParams}));

            const controlItem3 = getMockedControlItem({defaults: {number: 'one', size: 's'}});
            expect([
                {
                    id: DEFAULT_CONTROL_ID,
                    namespace: NAMESPACE,
                    params: {},
                },
            ]).toEqual(formQueueData({items: [controlItem3], itemsStateAndParams}));

            const controlItem4 = getMockedControlItem({defaults: {scale: 'm', size: 's'}});
            expect([
                {
                    id: DEFAULT_CONTROL_ID,
                    namespace: NAMESPACE,
                    params: {scale: 'd'},
                },
            ]).toEqual(formQueueData({items: [controlItem4], itemsStateAndParams}));

            const controlItem5 = getMockedControlItem({
                defaults: {scale: 'm', size: 's', view: 'contrast'},
            });
            expect([
                {
                    id: DEFAULT_CONTROL_ID,
                    namespace: NAMESPACE,
                    params: {
                        scale: 'd',
                        view: 'normal',
                    },
                },
            ]).toEqual(formQueueData({items: [controlItem5], itemsStateAndParams}));
        });

        it('return correct queue data for control: group control', () => {
            const itemsStateAndParams: ItemsStateAndParams = {
                [DEFAULT_CONTROL_ID]: {
                    params: {
                        [DEFAULT_GROUP_ITEM_ID]: {
                            scale: 'd',
                            view: 'normal',
                        },
                    },
                },
                [META_KEY]: {
                    queue: [{id: DEFAULT_CONTROL_ID, groupItemId: DEFAULT_GROUP_ITEM_ID}],
                    version: 2,
                },
            };

            const controlItem1 = getMockedGroupControlItem({
                id: 'control-1',
                groupItemId: 'group-control-1',
            });
            expect([]).toEqual(formQueueData({items: [controlItem1], itemsStateAndParams}));

            const controlItem2 = getMockedGroupControlItem({defaults: {number: 'one', size: 's'}});
            expect([
                {
                    id: DEFAULT_GROUP_ITEM_ID,
                    namespace: NAMESPACE,
                    params: {},
                },
            ]).toEqual(formQueueData({items: [controlItem2], itemsStateAndParams}));

            const controlItem4 = getMockedGroupControlItem({defaults: {scale: 'm', size: 's'}});
            expect([
                {
                    id: DEFAULT_GROUP_ITEM_ID,
                    namespace: NAMESPACE,
                    params: {
                        scale: 'd',
                    },
                },
            ]).toEqual(formQueueData({items: [controlItem4], itemsStateAndParams}));

            const controlItem5 = getMockedGroupControlItem({
                defaults: {scale: 'm', size: 's', view: 'contrast'},
            });
            expect([
                {
                    id: DEFAULT_GROUP_ITEM_ID,
                    namespace: NAMESPACE,
                    params: {
                        scale: 'd',
                        view: 'normal',
                    },
                },
            ]).toEqual(formQueueData({items: [controlItem5], itemsStateAndParams}));
        });

        it('return correct queue data for widget: common', () => {
            const itemsStateAndParams: ItemsStateAndParams = {
                [DEFAULT_WIDGET_ID]: {
                    params: {
                        scale: 'd',
                        view: 'normal',
                    },
                },
                [META_KEY]: {
                    queue: [{id: DEFAULT_WIDGET_ID, tabId: DEFAULT_WIDGET_TAB_ID}],
                    version: 2,
                },
            };

            const widgetItem1 = getMockedWidgetItem({id: 'widget-1'});
            expect([]).toEqual(formQueueData({items: [widgetItem1], itemsStateAndParams}));

            const widgetItem2 = getMockedWidgetItem({
                id: 'widget-2',
                tabs: [{id: DEFAULT_WIDGET_TAB_ID, params: {scale: 'm'}}],
            });
            expect([]).toEqual(formQueueData({items: [widgetItem2], itemsStateAndParams}));

            const widgetItem3 = getMockedWidgetItem({
                tabs: [{id: 'widget-3-tabId', params: {scale: 'm'}}],
            });
            expect([]).toEqual(formQueueData({items: [widgetItem3], itemsStateAndParams}));

            const widgetItem4 = getMockedWidgetItem({
                tabs: [{id: DEFAULT_WIDGET_TAB_ID}],
            });
            expect([
                {
                    id: DEFAULT_WIDGET_ID,
                    namespace: NAMESPACE,
                    params: {},
                },
            ]).toEqual(formQueueData({items: [widgetItem4], itemsStateAndParams}));

            const widgetItem5 = getMockedWidgetItem({
                tabs: [{id: DEFAULT_WIDGET_TAB_ID, params: {scale: 'm'}}],
            });
            expect([
                {
                    id: DEFAULT_WIDGET_ID,
                    namespace: NAMESPACE,
                    params: {scale: 'd'},
                },
            ]).toEqual(formQueueData({items: [widgetItem5], itemsStateAndParams}));
        });

        it('return correct queue data for widget: check tabs', () => {
            const TAB_ID = 'default_tab_id';
            const itemsStateAndParams1: ItemsStateAndParams = {
                [DEFAULT_WIDGET_ID]: {
                    params: {scale: 'd', view: 'normal'},
                    state: {tabId: DEFAULT_WIDGET_TAB_ID},
                },
                [META_KEY]: {
                    queue: [{id: DEFAULT_WIDGET_ID, tabId: DEFAULT_WIDGET_TAB_ID}],
                    version: 2,
                },
            };
            const itemsStateAndParams2: ItemsStateAndParams = {
                [DEFAULT_WIDGET_ID]: {
                    params: {scale: 'd', view: 'normal'},
                    state: {tabId: TAB_ID},
                },
                [META_KEY]: {
                    queue: [{id: DEFAULT_WIDGET_ID, tabId: TAB_ID}],
                    version: 2,
                },
            };
            const itemsStateAndParams3: ItemsStateAndParams = {
                [DEFAULT_WIDGET_ID]: {
                    params: {scale: 'd', view: 'normal'},
                    state: {tabId: 'anyTabId'},
                },
                [META_KEY]: {
                    queue: [{id: DEFAULT_WIDGET_ID, tabId: 'anyTabId'}],
                    version: 2,
                },
            };
            const widgetItem = getMockedWidgetItem({
                tabs: [
                    {id: DEFAULT_WIDGET_TAB_ID, params: {scale: 'm'}},
                    {id: TAB_ID, isDefault: true, params: {view: 'contrast'}},
                ],
            });

            expect([
                {
                    id: DEFAULT_WIDGET_ID,
                    namespace: NAMESPACE,
                    params: {scale: 'd'},
                },
            ]).toEqual(
                formQueueData({items: [widgetItem], itemsStateAndParams: itemsStateAndParams1}),
            );

            expect([
                {
                    id: DEFAULT_WIDGET_ID,
                    namespace: NAMESPACE,
                    params: {view: 'normal'},
                },
            ]).toEqual(
                formQueueData({items: [widgetItem], itemsStateAndParams: itemsStateAndParams2}),
            );

            expect([]).toEqual(
                formQueueData({items: [widgetItem], itemsStateAndParams: itemsStateAndParams3}),
            );
        });

        it('return correct queue data for controls and widgets', () => {
            const itemsStateAndParams: ItemsStateAndParams = {
                [DEFAULT_CONTROL_ID]: {
                    params: {
                        scale: 'd',
                    },
                },
                [DEFAULT_WIDGET_ID]: {
                    params: {
                        view: 'normal',
                    },
                },
                [DEFAULT_CONTROL_ID_2]: {
                    params: {
                        [DEFAULT_GROUP_ITEM_ID]: {
                            size: 'm',
                        },
                    },
                },
                [META_KEY]: {
                    queue: [
                        {id: DEFAULT_CONTROL_ID},
                        {id: DEFAULT_WIDGET_ID, tabId: DEFAULT_WIDGET_TAB_ID},
                        {id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID},
                    ],
                    version: 2,
                },
            };

            const widgetItem1 = getMockedWidgetItem({id: 'widget-1'});
            const widgetItem2 = getMockedWidgetItem({
                id: 'widget-2',
                tabs: [{id: 'widget-2-tabId', params: {view: 'contrast'}}],
            });
            const widgetItem3 = getMockedWidgetItem({
                tabs: [{id: DEFAULT_WIDGET_TAB_ID, params: {view: 'contrast'}}],
            });
            const control1 = getMockedControlItem({id: 'control-1'});
            const control2 = getMockedControlItem({defaults: {scale: 'm', view: 'contrast'}});
            const groupControl1 = getMockedGroupControlItem({id: 'group-control-1'});
            const groupControl2 = getMockedGroupControlItem({
                id: DEFAULT_CONTROL_ID_2,
                defaults: {size: 'xl', view: 'normal'},
            });
            expect([
                {
                    id: DEFAULT_CONTROL_ID,
                    namespace: NAMESPACE,
                    params: {
                        scale: 'd',
                    },
                },
                {
                    id: DEFAULT_WIDGET_ID,
                    namespace: NAMESPACE,
                    params: {view: 'normal'},
                },
                {
                    id: DEFAULT_GROUP_ITEM_ID,
                    namespace: NAMESPACE,
                    params: {
                        size: 'm',
                    },
                },
            ]).toEqual(
                formQueueData({
                    items: [
                        widgetItem2,
                        widgetItem3,
                        control1,
                        widgetItem1,
                        control2,
                        groupControl1,
                        groupControl2,
                    ],
                    itemsStateAndParams,
                }),
            );
        });
    });

    describe('actionParams helpers', () => {
        it('check hasActionParams', () => {
            const empty = hasActionParams({});
            expect(empty).toBeFalsy();

            const withParamsOnly = hasActionParams(stateAndParamsWithParamsOnly);
            expect(withParamsOnly).toBeFalsy();

            const withStateOnly = hasActionParams(stateAndParamsWithStateOnly);
            expect(withStateOnly).toBeFalsy();

            const withAPinParams = hasActionParams(stateAndParamsWithActionParamsInParamsOnly);
            expect(withAPinParams).toBeTruthy();

            const withAPinParamsNState = hasActionParams(
                stateAndParamsWithStateAndActionParamsInParams,
            );
            expect(withAPinParamsNState).toBeTruthy();

            const withParamsAndAPinParams = hasActionParams(
                stateAndParamsWithParamsAndActionParamsInParams,
            );
            expect(withParamsAndAPinParams).toBeTruthy();
        });

        it('check transformParamsToActionParams', () => {
            expect(paramsToTransform.out).toEqual(
                transformParamsToActionParams(paramsToTransform.in),
            );
        });

        it('check pickExceptActionParamsFromParams', () => {
            expect(exeptActionParam1.out).toEqual(
                pickExceptActionParamsFromParams(exeptActionParam1.in),
            );
            expect(exeptActionParam2.out).toEqual(
                pickExceptActionParamsFromParams(exeptActionParam2.in),
            );
            expect(exeptActionParam3.out).toEqual(
                pickExceptActionParamsFromParams(exeptActionParam3.in),
            );
        });
    });

    describe('queue helpers', () => {
        it('add common control to the end of queue', () => {
            const itemsStateAndParams: ItemsStateAndParams = {
                [META_KEY]: {
                    queue: [
                        {id: DEFAULT_CONTROL_ID},
                        {id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID},
                    ],
                    version: 2,
                },
            };

            const config = getMockedConfig({
                items: [
                    getMockedControlItem({}),
                    getMockedGroupControlItem({id: DEFAULT_CONTROL_ID_2}),
                ],
            });

            expect({
                queue: [
                    {id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID},
                    {id: DEFAULT_CONTROL_ID},
                ],
                version: 2,
            }).toEqual(addToQueue({id: DEFAULT_CONTROL_ID, config, itemsStateAndParams}));
        });

        it('remove unused items from queue after adding new group item: remove common items and group items', () => {
            const itemsStateAndParams: ItemsStateAndParams = {
                [META_KEY]: {
                    queue: [
                        {id: 'control1'},
                        {id: 'control2', tabId: 'tab'},
                        {id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID_2},
                        {id: DEFAULT_CONTROL_ID},
                        {id: DEFAULT_CONTROL_ID_2, groupItemId: 'group-item-1'},
                    ],
                    version: 2,
                },
            };

            const config = getMockedConfig({
                items: [
                    getMockedControlItem({}),
                    getMockedGroupControlItem({id: DEFAULT_CONTROL_ID_2}),
                ],
            });
            expect({
                queue: [
                    {id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID_2},
                    {id: DEFAULT_CONTROL_ID},
                    {id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID},
                ],
                version: 2,
            }).toEqual(
                addGroupToQueue({
                    id: DEFAULT_CONTROL_ID_2,
                    groupItemIds: [DEFAULT_GROUP_ITEM_ID],
                    config,
                    itemsStateAndParams,
                }),
            );
        });

        it('remove unused items from queue after adding new item: remove common items and item with group', () => {
            const itemsStateAndParams: ItemsStateAndParams = {
                [META_KEY]: {
                    queue: [
                        {id: 'control1'},
                        {id: 'control2', tabId: 'a3'},
                        {id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID_2},
                        {id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID},
                    ],
                    version: 2,
                },
            };

            const config = getMockedConfig({
                items: [getMockedControlItem({})],
            });
            expect({
                queue: [{id: DEFAULT_CONTROL_ID}],
                version: 2,
            }).toEqual(
                addToQueue({
                    id: DEFAULT_CONTROL_ID,
                    config,
                    itemsStateAndParams,
                }),
            );
        });

        it('add group control to queue', () => {
            const itemsStateAndParams: ItemsStateAndParams = {
                [META_KEY]: {
                    queue: [{id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID_2}],
                    version: 2,
                },
            };

            const config = getMockedConfig({
                items: [getMockedGroupControlItem({})],
            });
            expect({
                queue: [
                    {id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID},
                    {id: DEFAULT_CONTROL_ID_2, groupItemId: DEFAULT_GROUP_ITEM_ID_2},
                ],
                version: 2,
            }).toEqual(
                addGroupToQueue({
                    id: DEFAULT_CONTROL_ID_2,
                    groupItemIds: [DEFAULT_GROUP_ITEM_ID, DEFAULT_GROUP_ITEM_ID_2],
                    config,
                    itemsStateAndParams,
                }),
            );
        });
    });
});
