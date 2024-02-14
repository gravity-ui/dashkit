import omit from 'lodash/omit';

import {META_KEY} from '../../constants';
import {Config} from '../../types';
import {getItemsStateAndParamsDL} from '../datalens';

import mockConfigs from './configs.json';

export const stateAndParams1 = {
    in: {
        '0g': {
            params: {
                min: '300',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
            },
        },
        JX: {
            params: {
                min: '300',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
            },
        },
        V8: {
            params: {
                min: '300',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
            },
        },
        WZ: {
            state: {
                tabId: '2m',
            },
            params: {
                min: '300',
            },
        },
        Zb: {
            params: {
                min: '300',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
            },
        },
        qM: {
            params: {
                min: '300',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
            },
        },
    },
    out: {
        '0g': {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {},
        },
        JX: {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {},
        },
        WZ: {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                min: '300',
            },
            state: {
                tabId: '2m',
            },
        },
        Zb: {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {},
        },
        V8: {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {},
        },
        qM: {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {},
        },
    },
};

export const stateAndParams2 = {
    in: {
        JX: {
            params: {
                min: '20',
            },
        },
        WZ: {
            state: {
                tabId: '2m',
            },
        },
        Zb: {
            state: {
                tabId: 'om',
            },
            params: {
                min: '300',
            },
        },
        qM: {
            params: {
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
            },
        },
        __meta__: {
            queue: [
                {
                    id: 'JX',
                },
                {
                    id: 'Zb',
                    tabId: 'om',
                },
                {
                    id: 'qM',
                },
            ],
            version: 2,
        },
    },
    out: {
        __meta__: {
            queue: [
                {
                    id: 'JX',
                },
                {
                    id: 'Zb',
                    tabId: 'om',
                },
                {
                    id: 'qM',
                },
            ],
            version: 2,
        },
        '0g': {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {},
        },
        JX: {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {},
        },
        WZ: {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {
                tabId: '2m',
            },
        },
        Zb: {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {
                tabId: 'om',
            },
        },
        V8: {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {},
        },
        qM: {
            params: {
                '60487355-b211-4b64-977d-49db609b1106': '',
                'b147d8f0-30b0-41ba-a93c-d99897f473ed': 'A-Bomb',
                min: '300',
            },
            state: {},
        },
    },
};

export const stateAndParams3 = {
    in: {
        yd: {
            params: {
                b: '100',
            },
        },
        __meta__: {
            queue: [
                {
                    id: 'yd',
                },
            ],
            version: 2,
        },
    },
    out: {
        AD: {
            params: {
                a: '100',
                b: '100',
                c: '100',
            },
            state: {},
        },
        yd: {
            params: {
                a: '100',
                b: '100',
                c: '100',
            },
            state: {},
        },
        lA: {
            params: {
                a: '100',
                b: '100',
                c: '100',
            },
            state: {},
        },
        __meta__: {
            queue: [
                {
                    id: 'yd',
                },
            ],
            version: 2,
        },
    },
};

const stateAndParamsForAP1 = {
    in: {
        Q8: {params: {_ap_Country: 'Italy'}},
        __meta__: {queue: [{id: 'Q8', tabId: 'K0'}], version: 2},
    },
    out: {
        L5: {
            params: {Country: 'Italy', 'd079937f-6bc4-4133-9171-40092bb20d6f': 'Italy'},
            state: {},
        },
        Q8: {
            params: {
                Country: '',
                Year: '',
                _ap_Country: 'Italy',
                'd079937f-6bc4-4133-9171-40092bb20d6f': '',
            },
            state: {},
        },
        al: {
            params: {Country: 'Italy', 'd079937f-6bc4-4133-9171-40092bb20d6f': 'Italy'},
            state: {},
        },
    },
};

const stateAndParamsForAP2 = {
    in: {
        L5: {
            params: {'d079937f-6bc4-4133-9171-40092bb20d6f': 'Belgium'},
        },
        Q8: {
            params: {_ap_Country: 'Italy'},
        },
        __meta__: {queue: [{id: 'Q8', tabId: 'K0'}, {id: 'L5'}], version: 2},
    },
    out: {
        L5: {
            params: {Country: 'Belgium', 'd079937f-6bc4-4133-9171-40092bb20d6f': 'Belgium'},
            state: {},
        },
        Q8: {
            params: {
                Country: 'Belgium',
                Year: '',
                'd079937f-6bc4-4133-9171-40092bb20d6f': 'Belgium',
                _ap_Country: 'Italy',
            },
            state: {},
        },
        al: {
            params: {Country: 'Belgium', 'd079937f-6bc4-4133-9171-40092bb20d6f': 'Belgium'},
            state: {},
        },
    },
};

const stateAndParamsForAP3 = {
    in: {
        Q8: {params: {_ap_Country: 'Italy'}},
        L5: {params: {'d079937f-6bc4-4133-9171-40092bb20d6f': ''}},
        __meta__: {queue: [{id: 'Q8', tabId: 'K0'}, {id: 'L5'}], version: 2},
    },
    out: {
        L5: {
            params: {
                Country: '',
                'd079937f-6bc4-4133-9171-40092bb20d6f': '',
            },
            state: {},
        },
        Q8: {
            params: {
                Country: '',
                Year: '',
                'd079937f-6bc4-4133-9171-40092bb20d6f': '',
                _ap_Country: 'Italy',
            },
            state: {},
        },
        al: {
            params: {
                Country: '',
                'd079937f-6bc4-4133-9171-40092bb20d6f': '',
            },
            state: {},
        },
    },
};

const stateAndParamsForAP4 = {
    in: {
        Q8: {params: {_ap_Country: ''}},
        L5: {params: {'d079937f-6bc4-4133-9171-40092bb20d6f': ''}},
        __meta__: {queue: [{id: 'L5'}, {id: 'Q8', tabId: 'K0'}], version: 2},
    },
    out: {
        L5: {
            params: {
                Country: '',
                'd079937f-6bc4-4133-9171-40092bb20d6f': '',
            },
            state: {},
        },
        Q8: {
            params: {
                Country: '',
                Year: '',
                _ap_Country: '',
                'd079937f-6bc4-4133-9171-40092bb20d6f': '',
            },
            state: {},
        },
        al: {
            params: {
                Country: '',
                'd079937f-6bc4-4133-9171-40092bb20d6f': '',
            },
            state: {},
        },
    },
};

const stateAndParamsForAP5 = {
    in: {
        Q8: {params: {}},
        L5: {params: {}},
        __meta__: {queue: [], version: 2},
    },
    out: {
        L5: {
            params: {
                Country: ['Italy', 'France'],
                'd079937f-6bc4-4133-9171-40092bb20d6f': ['Italy', 'France'],
            },
            state: {},
        },
        Q8: {
            params: {
                Country: ['Italy', 'France'],
                Year: '',
                _ap_Country: 'Belgium',
                'd079937f-6bc4-4133-9171-40092bb20d6f': ['Italy', 'France'],
            },
            state: {},
        },
        al: {
            params: {
                Country: ['Italy', 'France'],
                'd079937f-6bc4-4133-9171-40092bb20d6f': ['Italy', 'France'],
            },
            state: {},
        },
    },
};

const stateAndParamsForAP6 = {
    in: {
        Q8: {
            params: {
                _ap_Year: '2021',
                _ap_Country: 'Russia',
            },
        },
        L5: {
            params: {
                _ap_Country: 'Russia',
                _ap_Name: 'Alex',
                _ap_Price: '1000',
            },
        },
        __meta__: {
            queue: [
                {id: 'Q8', tabId: 'K0'},
                {id: 'L5', tabId: 'K1'},
            ],
            version: 2,
        },
    },
    out: {
        L5: {
            params: {
                Name: '',
                Price: '',
                Year: '2021',
                Country: 'Russia',
                _ap_Country: 'Russia',
                _ap_Name: 'Alex',
                _ap_Price: '1000',
            },
            state: {},
        },
        Q8: {
            params: {
                Year: '',
                Country: 'Russia',
                Name: 'Alex',
                Price: '1000',
                _ap_Year: '2021',
                _ap_Country: 'Russia',
            },
            state: {},
        },
        al: {
            params: {
                Country: 'Russia',
                Name: 'Alex',
                Price: '1000',
                Year: '2021',
            },
            state: {},
        },
    },
};

const configs = mockConfigs.configs as unknown as Config[];

describe('getItemsStateAndParamsDL', () => {
    describe('old version fallback', () => {
        const oldResultItemsStateAndParams = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config: configs[0],
            itemsStateAndParams: stateAndParams1.in,
        });

        it('return stateAndParams1.out', () => {
            expect(oldResultItemsStateAndParams).toEqual(omit(stateAndParams1.out, META_KEY));
        });
    });

    describe('version 2 like the old version', () => {
        const resultItemsStateAndParams = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config: configs[0],
            itemsStateAndParams: stateAndParams2.in,
        });

        it('return stateAndParams2.out', () => {
            expect(resultItemsStateAndParams).toEqual(omit(stateAndParams2.out, META_KEY));
        });
    });

    describe('version 2: aliases work correctly ', () => {
        const resultItemsStateAndParams = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config: configs[1],
            itemsStateAndParams: stateAndParams3.in,
        });

        it('return stateAndParams3.out', () => {
            expect(resultItemsStateAndParams).toEqual(omit(stateAndParams3.out, META_KEY));
        });
    });
});

describe('getItemsStateAndParams actionParams variants check', () => {
    describe('action and params state 1', () => {
        const resultItemsStateAndParams = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config: configs[2],
            itemsStateAndParams: stateAndParamsForAP1.in,
        });

        it('return stateAndParamsForAP1.out', () => {
            expect(resultItemsStateAndParams).toEqual(omit(stateAndParamsForAP1.out, META_KEY));
        });
    });

    describe('action and params state 2', () => {
        const resultItemsStateAndParams = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config: configs[2],
            itemsStateAndParams: stateAndParamsForAP2.in,
        });

        it('return stateAndParamsForAP2.out', () => {
            expect(resultItemsStateAndParams).toEqual(omit(stateAndParamsForAP2.out, META_KEY));
        });
    });

    describe('action and params state 3', () => {
        const resultItemsStateAndParams = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config: configs[2],
            itemsStateAndParams: stateAndParamsForAP3.in,
        });

        it('return stateAndParamsForAP3.out', () => {
            expect(resultItemsStateAndParams).toEqual(omit(stateAndParamsForAP3.out, META_KEY));
        });
    });

    describe('action and params state 4', () => {
        const resultItemsStateAndParams = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config: configs[2],
            itemsStateAndParams: stateAndParamsForAP4.in,
        });

        it('return stateAndParamsForAP4.out', () => {
            expect(resultItemsStateAndParams).toEqual(omit(stateAndParamsForAP4.out, META_KEY));
        });
    });

    describe('action and params state 5', () => {
        const resultItemsStateAndParams = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config: configs[3],
            itemsStateAndParams: stateAndParamsForAP5.in,
        });

        it('return stateAndParamsForAP5.out', () => {
            expect(resultItemsStateAndParams).toEqual(omit(stateAndParamsForAP5.out, META_KEY));
        });
    });

    describe('action and params state 6', () => {
        const resultItemsStateAndParams = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config: configs[4],
            itemsStateAndParams: stateAndParamsForAP6.in,
        });

        it('return stateAndParamsForAP6.out', () => {
            expect(resultItemsStateAndParams).toEqual(omit(stateAndParamsForAP6.out, META_KEY));
        });
    });
});

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
        params: {
            year_some_id: ['2022'],
        },
        state: {},
    },
    nvp: {
        params: {
            _ap_year_some_id: ['2022'],
            year_some_id: '',
        },
        state: {},
    },
};

const itemsStateAndParamsActionParamTest2 = {
    nvp: {
        params: {
            _ap_another: ['2022'],
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

const stateAndParamsActionParamsRes2 = {
    Q9K: {
        params: {
            another: ['2022'],
            year_some_id: '',
        },
        state: {},
    },
    nvp: {
        params: {
            _ap_another: ['2022'],
            year_some_id: '',
        },
        state: {},
    },
};

describe('state and params with actionParams', () => {
    it('check state', () => {
        const res1 = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config,
            itemsStateAndParams: itemsStateAndParamsActionParamTest1,
        });
        expect(res1).toEqual(stateAndParamsActionParamsRes1);

        const res2 = getItemsStateAndParamsDL({
            defaultGlobalParams: {},
            globalParams: {},
            config,
            itemsStateAndParams: itemsStateAndParamsActionParamTest2,
        });
        expect(res2).toEqual(stateAndParamsActionParamsRes2);
    });
});
