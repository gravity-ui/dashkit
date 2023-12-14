import {ConfigItem, StringParams, ItemsStateAndParams, ConfigItemData} from '../../types';
import {ACTION_PARAM_PREFIX, META_KEY} from '../../constants';
import {
    formQueueData,
    hasActionParams,
    pickExceptActionParamsFromParams,
    transformParamsToActionParams,
} from '../helpers';
import {getItemsParams} from '../state-and-params';

const DEFAULT_CONTROL_ID = 'controlId';
const DEFAULT_WIDGET_ID = 'widgetId';
const DEFAULT_WIDGET_TAB_ID = 'widget_tabId';
const NAMESPACE = 'default';

type MockedControlItemArgs = {
    defaults?: StringParams;
    id?: string;
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

type MockedWidgetItemArgs = {
    id?: string;
    tabs?: ConfigItemData['tabs'];
};

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

const config = {
    id: '7kw',
    items: [
        {
            id: 'nvp',
            data: {
                tabs: [
                    {
                        id: 'rkq',
                        title: 'test',
                        params: {},
                        chartId: 'some-chart',
                        isDefault: true,
                        autoHeight: false,
                        description: '',
                        enableActionParams: true,
                    },
                ],
                hideTitle: true,
            },
            type: 'widget',
            layout: {
                h: 12,
                w: 12,
            },
            namespace: 'default',
        },
        {
            id: 'Q9K',
            data: {
                title: 'Year',
                source: {},
            },
            type: 'control',
            layout: {
                h: 2,
                w: 8,
            },
            defaults: {
                year_some_id: '',
            },
            namespace: 'default',
        },
    ],
    title: 'test',
    layout: [
        {
            h: 12,
            i: 'nvp',
            w: 12,
            x: 0,
            y: 0,
        },
        {
            h: 2,
            i: 'Q9K',
            w: 8,
            x: 12,
            y: 0,
        },
    ],
    aliases: {},
    connections: [],
    salt: '123',
    counter: 1,
};
const itemsStateAndParamsActionParamTest1 = {
    nvp: {
        params: {
            _ap_year_some_id: ['2022'],
        },
    },
    __meta__: {
        queue: [
            {
                id: 'nvp',
                tabId: 'rkq',
            },
        ],
        version: 2,
    },
};

const stateAndParamsActionParamsRes1 = {
    Q9K: {
        year_some_id: ['2022'],
    },
    nvp: {
        _ap_year_some_id: ['2022'],
        year_some_id: '',
    },
};

const plugins = [
    {
        type: 'title',
        defaultLayout: {
            x: 0,
            y: null,
            w: 36,
            h: 2,
            minW: 4,
            minH: 2,
        },
    },
    {
        type: 'text',
        defaultLayout: {
            x: 0,
            y: null,
            w: 12,
            h: 6,
            minW: 4,
            minH: 2,
        },
    },
    {
        getDistincts: {
            promise: {},
        },
        type: 'control',
        defaultLayout: {
            x: 0,
            y: null,
            w: 8,
            h: 2,
            minW: 4,
            minH: 2,
        },
    },
    {
        type: 'widget',
        defaultLayout: {
            x: 0,
            y: null,
            w: 12,
            h: 12,
            minW: 4,
            minH: 2,
        },
    },
];

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
                [META_KEY]: {
                    queue: [
                        {id: DEFAULT_CONTROL_ID},
                        {id: DEFAULT_WIDGET_ID, tabId: DEFAULT_WIDGET_TAB_ID},
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
            expect([
                {
                    id: DEFAULT_CONTROL_ID,
                    namespace: NAMESPACE,
                    params: {scale: 'd'},
                },
                {
                    id: DEFAULT_WIDGET_ID,
                    namespace: NAMESPACE,
                    params: {view: 'normal'},
                },
            ]).toEqual(
                formQueueData({
                    items: [widgetItem2, widgetItem3, control1, widgetItem1, control2],
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

    describe('state and params with actionParams', () => {
        it('check state 1', () => {
            const res = getItemsParams({
                defaultGlobalParams: {},
                globalParams: {},
                config,
                itemsStateAndParams: itemsStateAndParamsActionParamTest1,
                plugins,
            });
            expect(res).toEqual(stateAndParamsActionParamsRes1);
        });
    });
});
