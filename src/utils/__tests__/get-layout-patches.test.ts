import type {ConfigLayout} from '../../shared';
import {getLayoutPatches} from '../get-layout-patches';

describe('getLayoutPatches', () => {
    it('empty arrays returns empty patches', () => {
        expect(getLayoutPatches([], [])).toEqual([]);
    });

    it('single item with x change returns patch', () => {
        const previousLayout: ConfigLayout[] = [{i: 'a', x: 0, y: 0, w: 2, h: 2}];
        const nextLayout: ConfigLayout[] = [{i: 'a', x: 1, y: 0, w: 2, h: 2}];

        expect(getLayoutPatches(previousLayout, nextLayout)).toEqual([
            {i: 'a', x: 1, y: 0, w: 2, h: 2},
        ]);
    });

    it('single item with parent change returns patch', () => {
        const previousLayout: ConfigLayout[] = [{i: 'a', x: 0, y: 0, w: 2, h: 2, parent: 'g1'}];
        const nextLayout: ConfigLayout[] = [{i: 'a', x: 0, y: 0, w: 2, h: 2, parent: 'g2'}];

        expect(getLayoutPatches(previousLayout, nextLayout)).toEqual([
            {i: 'a', x: 0, y: 0, w: 2, h: 2, parent: 'g2'},
        ]);
    });

    it('single item with no changes returns empty patches', () => {
        const previousLayout: ConfigLayout[] = [{i: 'a', x: 0, y: 0, w: 2, h: 2}];
        const nextLayout: ConfigLayout[] = [{i: 'a', x: 0, y: 0, w: 2, h: 2}];

        expect(getLayoutPatches(previousLayout, nextLayout)).toEqual([]);
    });

    it('item in previousLayout but not in nextLayout returns empty patches', () => {
        const previousLayout: ConfigLayout[] = [{i: 'a', x: 0, y: 0, w: 2, h: 2}];
        const nextLayout: ConfigLayout[] = [];

        expect(getLayoutPatches(previousLayout, nextLayout)).toEqual([]);
    });

    it('item in nextLayout but not in previousLayout returns empty patches', () => {
        const previousLayout: ConfigLayout[] = [];
        const nextLayout: ConfigLayout[] = [{i: 'a', x: 0, y: 0, w: 2, h: 2}];

        expect(getLayoutPatches(previousLayout, nextLayout)).toEqual([]);
    });

    it('multiple items only changed ones in patches', () => {
        const previousLayout: ConfigLayout[] = [
            {i: 'a', x: 0, y: 0, w: 2, h: 2},
            {i: 'b', x: 2, y: 0, w: 2, h: 2},
        ];
        const nextLayout: ConfigLayout[] = [
            {i: 'a', x: 1, y: 0, w: 2, h: 2},
            {i: 'b', x: 2, y: 0, w: 2, h: 2},
        ];

        expect(getLayoutPatches(previousLayout, nextLayout)).toEqual([
            {i: 'a', x: 1, y: 0, w: 2, h: 2},
        ]);
    });
});
