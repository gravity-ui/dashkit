import type {Config} from '../../shared';
import {UpdateManager} from '../update-manager';

const config: Config = {
    salt: '0.09852189776033704',
    counter: 14,
    items: [
        {
            id: 'al',
            data: {
                tabs: [
                    {
                        id: 'Jn',
                        title: 'tab 1',
                        params: {
                            Country: 'Germany',
                        },
                        chartId: 'h8hfbffyo3dg8',
                        isDefault: true,
                        autoHeight: false,
                    },
                    {
                        id: 'Pf',
                        title: 'tab 2',
                        params: {},
                        chartId: 'f5hfbl3yo3dh7',
                        isDefault: false,
                        autoHeight: false,
                    },
                ],
                hideTitle: true,
            },
            type: 'widget',
            namespace: 'default',
        },
        {
            id: 'Q8',
            data: {
                tabs: [
                    {
                        id: 'K0',
                        title: 'filtering_charts_table (charteditor)',
                        params: {
                            Year: '',
                            Country: '',
                            _ap_Country: 'Belgium',
                        },
                        chartId: '245z37u4ylvet',
                        isDefault: true,
                        autoHeight: false,
                    },
                ],
                hideTitle: false,
            },
            type: 'widget',
            namespace: 'default',
        },
        {
            id: 'L5',
            data: {
                title: 'Country',
                source: {
                    datasetId: 'gyrnhj945gum9',
                    fieldType: 'string',
                    showTitle: true,
                    innerTitle: 'Inner title',
                    elementType: 'select',
                    datasetFieldId: 'd079',
                    showInnerTitle: false,
                    datasetFieldType: 'DIMENSION',
                },
                sourceType: 'dataset',
            },
            type: 'control',
            defaults: {
                d079: ['Italy', 'France'],
            },
            namespace: 'default',
        },
        {
            id: 'C8',
            data: {
                title: 'Client',
                source: {
                    datasetId: 'rfvnhj345gugf',
                    fieldType: 'string',
                    showTitle: true,
                    innerTitle: 'Inner title',
                    elementType: 'select',
                    datasetFieldId: 'g129',
                    showInnerTitle: false,
                    datasetFieldType: 'DIMENSION',
                },
                sourceType: 'dataset',
            },
            type: 'control',
            defaults: {
                g129: ['Alex'],
            },
            namespace: 'default',
        },
        {
            id: 'lko',
            data: {
                title: 'External control',
                source: {
                    chartId: 'deuaclrdakbc4',
                },
                autoHeight: true,
                sourceType: 'external',
            },
            type: 'control',
            defaults: {
                Name: '',
                Brand: '',
                Label: '',
            },
            namespace: 'default',
        },
        {
            id: 'qY',
            data: {
                group: [
                    {
                        id: '9YN',
                        title: 'Category',
                        width: '',
                        source: {
                            datasetId: 'rfvnhj345gugf',
                            fieldType: 'string',
                            elementType: 'select',
                            datasetFieldId: 'ab089',
                            datasetFieldType: 'DIMENSION',
                        },
                        defaults: {
                            ab089: '',
                        },
                        sourceType: 'dataset',
                        placementMode: 'auto',
                        namespace: 'default',
                    },
                    {
                        id: 'qav',
                        title: 'Селектор 1',
                        width: '',
                        source: {
                            fieldName: 'sds',
                            elementType: 'select',
                            acceptableValues: [
                                {
                                    title: '2',
                                    value: '2',
                                },
                                {
                                    title: '34',
                                    value: '34',
                                },
                            ],
                        },
                        defaults: {
                            sds: '',
                        },
                        sourceType: 'manual',
                        placementMode: 'auto',
                        namespace: 'default',
                    },
                ],
                autoHeight: true,
                buttonApply: false,
                buttonReset: false,
            },
            type: 'group_control',
            namespace: 'default',
        },
    ],
    layout: [
        {h: 4, i: 'al', w: 4, x: 8, y: 0},
        {h: 16, i: 'Q8', w: 12, x: 12, y: 0},
        {h: 2, i: 'L5', w: 8, x: 0, y: 2},
        {h: 2, i: 'C8', w: 8, x: 10, y: 30},
        {h: 2, i: 'lko', w: 8, x: 0, y: 12},
        {h: 2, i: 'qY', w: 8, x: 0, y: 24},
    ],
    aliases: {},
    connections: [],
};

beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(jest.fn());
});

describe('UpdateManager', () => {
    describe('changeStateAndParams', () => {
        it('control adds params to empty itemsStateAndParams: common control', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'L5',
                    config,
                    itemsStateAndParams: {},
                    stateAndParams: {
                        params: {
                            d079: ['Russia'],
                        },
                    },
                }),
            ).toEqual({
                L5: {
                    params: {
                        d079: ['Russia'],
                    },
                },
                __meta__: {queue: [{id: 'L5'}], version: 2},
            });
        });

        it('control adds params to empty itemsStateAndParams: group control', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'qY',
                    config,
                    itemsStateAndParams: {},
                    stateAndParams: {
                        params: {
                            ab089: ['red'],
                        },
                    },
                    options: {
                        groupItemId: '9YN',
                    },
                }),
            ).toEqual({
                qY: {
                    params: {
                        '9YN': {
                            ab089: ['red'],
                        },
                    },
                },
                __meta__: {queue: [{id: 'qY', groupItemId: '9YN'}], version: 2},
            });
        });

        it('state changes only do not push into the queue', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'al',
                    config,
                    itemsStateAndParams: {
                        L5: {
                            params: {
                                d079: ['Russia'],
                            },
                        },
                        qY: {
                            params: {
                                '9YN': {
                                    ab089: ['red'],
                                },
                            },
                        },
                        __meta__: {
                            queue: [{id: 'L5'}, {id: 'qY', groupItemId: '9YN'}, {id: 'Unk'}],
                            version: 2,
                        },
                    },
                    stateAndParams: {
                        state: {tabId: 'Pf'},
                    },
                }),
            ).toEqual({
                L5: {
                    params: {
                        d079: ['Russia'],
                    },
                },
                qY: {
                    params: {
                        '9YN': {
                            ab089: ['red'],
                        },
                    },
                },
                al: {
                    state: {
                        tabId: 'Pf',
                    },
                },
                __meta__: {queue: [{id: 'L5'}, {id: 'qY', groupItemId: '9YN'}], version: 2},
            });
        });

        it('tab changes clear previous tab params', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'al',
                    config,
                    itemsStateAndParams: {
                        al: {
                            state: {
                                tabId: 'Jn',
                            },
                            params: {
                                Country: 'USA',
                            },
                        },
                        __meta__: {queue: [{id: 'al', tabId: 'Jn'}], version: 2},
                    },
                    stateAndParams: {
                        state: {tabId: 'Pf'},
                    },
                }),
            ).toEqual({
                al: {
                    state: {
                        tabId: 'Pf',
                    },
                },
                __meta__: {queue: [], version: 2},
            });
        });

        it('control changes rearrange position in the queue: common control', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'L5',
                    config,
                    itemsStateAndParams: {
                        al: {
                            state: {
                                tabId: 'Jn',
                            },
                            params: {
                                Country: 'USA',
                            },
                        },
                        L5: {
                            params: {
                                d079: ['Russia'],
                            },
                        },
                        C8: {
                            params: {
                                g129: ['Anton'],
                            },
                        },
                        __meta__: {
                            queue: [{id: 'L5'}, {id: 'C8'}, {id: 'al', tabId: 'Jn'}, {id: 'Unk'}],
                            version: 2,
                        },
                    },
                    stateAndParams: {
                        params: {
                            d079: ['Oman'],
                        },
                    },
                }),
            ).toEqual({
                al: {
                    state: {
                        tabId: 'Jn',
                    },
                    params: {
                        Country: 'USA',
                    },
                },
                L5: {
                    params: {
                        d079: ['Oman'],
                    },
                },
                C8: {
                    params: {
                        g129: ['Anton'],
                    },
                },
                __meta__: {
                    queue: [{id: 'C8'}, {id: 'al', tabId: 'Jn'}, {id: 'L5'}],
                    version: 2,
                },
            });
        });

        it('control changes rearrange position in the queue: group control', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'qY',
                    config,
                    itemsStateAndParams: {
                        al: {
                            params: {
                                Country: 'USA',
                            },
                        },
                        qY: {
                            params: {
                                qav: {
                                    sds: ['yellow'],
                                },
                            },
                        },
                        __meta__: {
                            queue: [{id: 'qY', groupItemId: 'qav'}, {id: 'al'}],
                            version: 2,
                        },
                    },
                    stateAndParams: {
                        params: {
                            qav: {
                                sds: ['violet'],
                            },
                        },
                    },
                    options: {
                        groupItemId: 'qav',
                    },
                }),
            ).toEqual({
                al: {
                    params: {
                        Country: 'USA',
                    },
                },
                qY: {
                    params: {
                        qav: {
                            sds: ['violet'],
                        },
                    },
                },
                __meta__: {
                    queue: [{id: 'al'}, {id: 'qY', groupItemId: 'qav'}],
                    version: 2,
                },
            });
        });

        it('control params should merge', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'lko',
                    config,
                    itemsStateAndParams: {
                        L5: {
                            params: {
                                d079: ['Russia'],
                            },
                        },
                        lko: {
                            params: {
                                Brand: ['Nuke'],
                                Label: ['pin'],
                            },
                        },
                        __meta__: {
                            queue: [{id: 'lko'}, {id: 'L5'}],
                            version: 2,
                        },
                    },
                    stateAndParams: {
                        params: {
                            Name: ['Jack'],
                            Label: ['clone'],
                        },
                    },
                }),
            ).toEqual({
                L5: {
                    params: {
                        d079: ['Russia'],
                    },
                },
                lko: {
                    params: {
                        Brand: ['Nuke'],
                        Name: ['Jack'],
                        Label: ['clone'],
                    },
                },
                __meta__: {queue: [{id: 'L5'}, {id: 'lko'}], version: 2},
            });
        });

        it('control cannot set params not from defaults: common control', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'lko',
                    config,
                    itemsStateAndParams: {},
                    stateAndParams: {
                        params: {
                            Brand: ['Nuke'],
                            UnknownParam: ['Value'],
                        },
                    },
                }),
            ).toEqual({
                lko: {
                    params: {
                        Brand: ['Nuke'],
                    },
                },
                __meta__: {queue: [{id: 'lko'}], version: 2},
            });
        });

        it('control cannot set params not from defaults: group control', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'qY',
                    config,
                    itemsStateAndParams: {},
                    stateAndParams: {
                        params: {
                            sds: ['value'],
                            UnknownParam: ['Value'],
                        },
                    },
                    options: {groupItemId: 'qav'},
                }),
            ).toEqual({
                qY: {
                    params: {
                        qav: {
                            sds: ['value'],
                        },
                    },
                },
                __meta__: {queue: [{id: 'qY', groupItemId: 'qav'}], version: 2},
            });
        });

        it('filtering_charts_table can set action params not from defaults', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'Q8',
                    config,
                    itemsStateAndParams: {},
                    stateAndParams: {
                        params: {
                            _ap_Country: 'Germany',
                            _ap_Brand: 'Pule',
                            _ap_Year: '2020',
                        },
                        state: {
                            tabId: 'K0',
                        },
                    },
                }),
            ).toEqual({
                Q8: {
                    state: {
                        tabId: 'K0',
                    },
                    params: {
                        _ap_Country: 'Germany',
                        _ap_Brand: 'Pule',
                        _ap_Year: '2020',
                    },
                },
                __meta__: {queue: [{id: 'Q8', tabId: 'K0'}], version: 2},
            });
        });

        it('the item is correctly removed from the queue', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'Q8',
                    config,
                    itemsStateAndParams: {
                        L5: {
                            params: {
                                d079: ['Russia'],
                            },
                        },
                        Q8: {
                            state: {
                                tabId: 'K0',
                            },
                            params: {
                                _ap_Country: 'Germany',
                                _ap_Year: '2020',
                            },
                        },
                        Unk: {
                            params: {
                                Country: 'Unknown',
                            },
                        },
                        __meta__: {
                            queue: [{id: 'Q8', tabId: 'K0'}, {id: 'Unk'}, {id: 'L5'}],
                            version: 2,
                        },
                    },
                    stateAndParams: {},
                    options: {action: 'removeItem'},
                }),
            ).toEqual({
                L5: {
                    params: {
                        d079: ['Russia'],
                    },
                },
                __meta__: {queue: [{id: 'L5'}], version: 2},
            });

            expect(
                UpdateManager.changeStateAndParams({
                    id: 'Q8',
                    config,
                    itemsStateAndParams: {
                        L5: {
                            params: {
                                d079: ['Russia'],
                            },
                        },
                        __meta__: {
                            queue: [{id: 'L5'}],
                            version: 2,
                        },
                    },
                    stateAndParams: {},
                    options: {action: 'removeItem'},
                }),
            ).toEqual({
                L5: {
                    params: {
                        d079: ['Russia'],
                    },
                },
                __meta__: {queue: [{id: 'L5'}], version: 2},
            });
        });

        it('the item is correctly setParams using additional options', () => {
            expect(
                UpdateManager.changeStateAndParams({
                    id: 'Q8',
                    config,
                    itemsStateAndParams: {
                        L5: {
                            params: {
                                d079: ['Russia'],
                            },
                        },
                        Q8: {
                            state: {
                                tabId: 'K0',
                            },
                            params: {
                                _ap_Country: 'Germany',
                                _ap_Year: '2020',
                            },
                        },
                        __meta__: {
                            queue: [{id: 'Q8', tabId: 'K0'}, {id: 'L5'}],
                            version: 2,
                        },
                    },
                    stateAndParams: {
                        state: {
                            tabId: 'K0',
                        },
                        params: {
                            _ap_Country: 'Russia',
                        },
                    },
                    options: {action: 'setParams'},
                }),
            ).toEqual({
                L5: {
                    params: {
                        d079: ['Russia'],
                    },
                },
                Q8: {
                    state: {
                        tabId: 'K0',
                    },
                    params: {
                        _ap_Country: 'Russia',
                    },
                },
                __meta__: {queue: [{id: 'L5'}, {id: 'Q8', tabId: 'K0'}], version: 2},
            });
        });
    });
});
