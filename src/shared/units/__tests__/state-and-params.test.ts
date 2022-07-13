import omit from 'lodash/omit';
import {META_KEY} from '../../constants';
import {getItemsStateAndParamsDL} from '../datalens';
import {Config} from '../../types';
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
