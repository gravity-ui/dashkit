/** @jest-environment jsdom */
import {DashKitEngine} from '../engine';
import {requireValue} from '../invariants';

const nodes = (engine: DashKitEngine) =>
    engine.nodes
        .map(({id, x, y, w, h}) => ({id, x, y, w, h}))
        .sort((a, b) => requireValue(a.id, 'a.id').localeCompare(requireValue(b.id, 'b.id')));

// Critical: yes. Native bounded simulations must not move unrelated saved report widgets.
test('overlap survives bounded batch load, move, resize and removal', () => {
    const engine = new DashKitEngine({column: 640, maxRow: 400});
    engine.mode = {allowOverlap: true, compactType: null};
    engine.batchUpdate();
    const a = engine.addNode({id: 'a', x: 40, y: 40, w: 160, h: 100});
    const b = engine.addNode({id: 'b', x: 120, y: 80, w: 180, h: 120});
    engine.batchUpdate(false);
    engine.moveNodeCheck(b as (typeof engine.nodes)[number], {x: 80, y: 60});
    expect(nodes(engine)).toEqual([
        {id: 'a', x: 40, y: 40, w: 160, h: 100},
        {id: 'b', x: 80, y: 60, w: 180, h: 120},
    ]);
    engine.moveNodeCheck(b as (typeof engine.nodes)[number], {x: 999, y: 999});
    expect(b).toMatchObject({x: 460, y: 280});
    engine.moveNodeCheck(b as (typeof engine.nodes)[number], {
        x: 20,
        y: 20,
        w: 900,
        h: 900,
        resizing: true,
    });
    expect(b).toMatchObject({x: 20, y: 20, w: 620, h: 380});
    engine.removeNode(b, false);
    expect(a).toMatchObject({x: 40, y: 40, w: 160, h: 100});
});

test.each([
    [
        'vertical',
        [
            {id: 'a', x: 2, y: 0, w: 3, h: 2},
            {id: 'b', x: 1, y: 1, w: 3, h: 2},
        ],
        [
            {id: 'a', x: 2, y: 0, w: 3, h: 2},
            {id: 'b', x: 1, y: 2, w: 3, h: 2},
        ],
    ],
    [
        'horizontal',
        [
            {id: 'a', x: 6, y: 0, w: 3, h: 2},
            {id: 'b', x: 0, y: 2, w: 3, h: 2},
        ],
        [
            {id: 'a', x: 0, y: 0, w: 3, h: 2},
            {id: 'b', x: 0, y: 2, w: 3, h: 2},
        ],
    ],
] as const)('compacts %s without reversing collision priority', (compactType, input, expected) => {
    const engine = new DashKitEngine({column: 12});
    engine.mode = {compactType};
    engine.batchUpdate();
    input.forEach((entry) => engine.addNode({...entry}));
    engine.batchUpdate(false);
    expect(nodes(engine)).toEqual(expected);
});

test('preventCollision rejects an occupied move and preserves min/max constraints', () => {
    const engine = new DashKitEngine({column: 12, maxRow: 10});
    engine.mode = {compactType: null, preventCollision: true};
    engine.addNode({id: 'a', x: 0, y: 0, w: 3, h: 2});
    const b = engine.addNode({id: 'b', x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3});
    expect(engine.moveNodeCheck(b as (typeof engine.nodes)[number], {x: 1, y: 0})).toBe(false);
    expect(b).toMatchObject({x: 6, y: 0});
    engine.moveNodeCheck(b as (typeof engine.nodes)[number], {w: 10, h: 9, resizing: true});
    expect(b).toMatchObject({w: 4, h: 3});
    engine.moveNodeCheck(b as (typeof engine.nodes)[number], {w: 1, h: 1, resizing: true});
    expect(b).toMatchObject({w: 2, h: 2});
});

test('nowrap consumes remaining width and rejects growth beyond the row', () => {
    const engine = new DashKitEngine({column: 12, maxRow: 2});
    engine.mode = {compactType: 'horizontal-nowrap'};
    engine.addNode({id: 'a', x: 0, y: 0, w: 8, h: 2});
    const b = engine.addNode({id: 'b', x: 8, y: 0, w: 3, h: 2});
    engine.moveNodeCheck(b as (typeof engine.nodes)[number], {w: 9, y: 3, resizing: true});
    expect(b).toMatchObject({x: 8, y: 0, w: 4});
});

test('finite nowrap fit rejects a second row even when vertical bounds have room', () => {
    const engine = new DashKitEngine({column: 12, maxRow: 4});
    engine.mode = {compactType: 'horizontal-nowrap'};
    engine.batchUpdate();
    engine.addNode({id: 'a', x: 0, y: 0, w: 8, h: 2});
    engine.addNode({id: 'b', x: 8, y: 0, w: 4, h: 2});
    engine.batchUpdate(false);
    expect(engine.willItFit({w: 1, h: 1})).toBe(false);
    expect(nodes(engine)).toEqual([
        {id: 'a', x: 0, y: 0, w: 8, h: 2},
        {id: 'b', x: 8, y: 0, w: 4, h: 2},
    ]);
});

// Critical: yes. Repeated native palette motion must keep a fitting preview instead of flickering/rejecting it.
test('nowrap fit excludes the existing preview from both width budget and simulation', () => {
    const engine = new DashKitEngine({column: 12, maxRow: 4});
    engine.mode = {compactType: 'horizontal-nowrap'};
    engine.addNode({id: 'saved', x: 0, y: 0, w: 8, h: 2});
    engine.addNode({id: 'preview', x: 8, y: 0, w: 4, h: 2});
    const before = nodes(engine);
    for (let motion = 0; motion < 3; motion++) {
        expect(engine.willItFit({id: 'preview', x: 8, y: 0, w: 4, h: 2})).toBe(true);
    }
    expect(nodes(engine)).toEqual(before);
    expect(engine.willItFit({id: 'another', w: 1, h: 1})).toBe(false);
});

// Critical: yes. Packing must not silently rewrite an allowed overlapping gesture before save.
test.each([null, 'vertical', 'horizontal', 'horizontal-nowrap'] as const)(
    'public engine move respects overlap with %s compaction',
    (compactType) => {
        for (const allowOverlap of [true, false]) {
            const engine = new DashKitEngine({column: 12, maxRow: 10, float: true});
            engine.mode = {compactType, allowOverlap};
            engine.restoring = true;
            engine.addNode({id: 'a', x: 0, y: 0, w: 4, h: 2});
            const b = engine.addNode({id: 'b', x: 6, y: 0, w: 3, h: 2});
            engine.restoring = false;
            engine.moveNodeCheck(b as (typeof engine.nodes)[number], {x: 2, y: 1});
            if (allowOverlap) {
                expect(b).toMatchObject({x: 2, y: compactType === 'horizontal-nowrap' ? 0 : 1});
                expect(engine.nodes[0]).toMatchObject({x: 0, y: 0});
            } else {
                const [a, moved] = engine.nodes;
                expect(
                    a.x < moved.x + moved.w &&
                        moved.x < a.x + a.w &&
                        a.y < moved.y + moved.h &&
                        moved.y < a.y + a.h,
                ).toBe(false);
            }
        }
    },
);
