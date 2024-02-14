import Hashids from 'hashids';

import type {Config} from '../../types';
import {extractIdsFromConfig, generateUniqId} from '../uniq-id';

const salt = 'salt';
const hashids = new Hashids(salt);
const testCounter = 1;

const id1 = hashids.encode(testCounter + 1);
const id2 = hashids.encode(testCounter + 2);
const id3 = hashids.encode(testCounter + 3);
const id4 = hashids.encode(testCounter + 4);

describe('modules.uniq-id: generateUniqId', () => {
    it('return correct first id and counter', () => {
        const {id, counter} = generateUniqId({
            counter: testCounter,
            ids: [],
            salt,
        });

        expect(hashids.encode(counter)).toEqual(id1);

        expect(id).toEqual(id1);
        expect(counter).toEqual(testCounter + 1);
    });

    it('return correct id and counter with ids=[id1]', () => {
        const {id, counter} = generateUniqId({
            counter: testCounter + 1,
            ids: [id1],
            salt,
        });

        expect(hashids.encode(counter)).toEqual(id2);

        expect(id).toEqual(id2);
        expect(counter).toEqual(testCounter + 2);
    });

    it('return correct id4 and counter with ids=[id1, id2, id3] and incorrect counter=1', () => {
        const {id, counter} = generateUniqId({
            counter: 1,
            ids: [id1, id2, id3],
            salt,
        });

        expect(hashids.encode(counter)).toEqual(id4);

        expect(id).toEqual(id4);
        expect(counter).toEqual(testCounter + 4);
    });
});

const IDS = ['WZ', '9X', '2m', 'R2', 'Pd'];
const config = {
    items: [
        {
            id: IDS[0],
            data: {
                tabs: [
                    {
                        id: IDS[1],
                    },
                    {
                        id: IDS[2],
                    },
                ],
            },
        },
        {
            id: IDS[3],
        },
    ],
    layout: [{i: IDS[0]}, {i: IDS[3]}],
    connections: [
        {from: IDS[2], to: IDS[4]},
        {from: IDS[1], to: IDS[3]},
    ],
} as Config;

describe('modules.uniq-id: extractIdsFromConfig', () => {
    it('correct extract ids from config', () => {
        const ids = extractIdsFromConfig(config);

        expect(Array.isArray(ids)).toBe(true);

        expect(IDS.concat().sort()).toEqual(ids.sort());
    });
});
