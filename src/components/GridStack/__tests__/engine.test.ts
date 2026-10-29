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

test('converted native drop survives admission, clone bounds and preview fit', () => {
    const engine = new DashKitEngine({column: 12, maxRow: 10, float: true});
    engine.mode = {compactType: null};
    engine.addNode({id: 'occupied', x: 0, y: 5, w: 12, h: 5});
    const source = {id: 'moving', x: 0, y: 0, w: 10, h: 10};
    engine.dropSize = {id: 'moving', w: 10, h: 4};
    expect(engine.willItFit({w: source.w, h: source.h})).toBe(true);
    const preview = {...source};
    engine.nodeBoundFix(preview);
    expect(engine.willItFit(preview)).toBe(true);
    expect(preview).toMatchObject({w: 10, h: 4});
    expect(source).toEqual({id: 'moving', x: 0, y: 0, w: 10, h: 10});
    expect(nodes(engine)).toEqual([{id: 'occupied', x: 0, y: 5, w: 12, h: 5}]);
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

// Critical: yes. Native moves and admission must not enlarge accepted saved widgets or displace edge positions.
test.each([
    {x: 0.5, y: 0.5},
    {x: 11.5, y: 3.5},
])(
    'fractional load, move and fit retain dimensions at %j and resizing still enforces constraints',
    ({x, y}) => {
        const engine = new DashKitEngine({column: 12, maxRow: 4, float: true});
        engine.mode = {compactType: null};
        const constraints = {minW: 2, minH: 2, maxW: 3, maxH: 3};
        const saved = {id: 'fraction', x, y, w: 0.5, h: 0.5, ...constraints};
        const a = engine.addNode({...saved}) as (typeof engine.nodes)[number];
        const other = engine.addNode({id: 'other', x: 5, y: 0, w: 2, h: 2});
        expect(a).toMatchObject(saved);
        engine.batchUpdate();
        engine.batchUpdate(false);
        expect(engine.moveNodeCheck(a, {x, y})).toBe(false);
        expect(engine.getDirtyNodes()).toEqual([]);
        const candidate = {...saved};
        expect(engine.willItFit(candidate)).toBe(true);
        expect(candidate).toMatchObject({...saved, _willFitPos: {x, y, w: 0.5, h: 0.5}});
        expect(nodes(engine)).toEqual([
            {id: 'fraction', x, y, w: 0.5, h: 0.5},
            {id: 'other', x: 5, y: 0, w: 2, h: 2},
        ]);
        expect(engine.moveNodeCheck(a, {x: 11.75, y: 3.75})).toBe(x !== 11.5 || y !== 3.5);
        expect(a).toMatchObject({...constraints, x: 11.5, y: 3.5, w: 0.5, h: 0.5});
        engine.batchUpdate();
        engine.batchUpdate(false);
        engine.nodeBoundFix(a);
        expect(engine.getDirtyNodes()).toEqual([]);
        expect(engine.moveNodeCheck(a, {x: -0.25, y: -0.25})).toBe(true);
        expect(a).toMatchObject({x: 0, y: 0, w: 0.5, h: 0.5});
        expect(other).toMatchObject({x: 5, y: 0, w: 2, h: 2});
        engine.moveNodeCheck(a, {w: 0.25, h: 0.25, resizing: true});
        expect(a).toMatchObject({...constraints, w: 2, h: 2});
        engine.moveNodeCheck(a, {w: 8, h: 8, resizing: true});
        expect(a).toMatchObject({...constraints, w: 3, h: 3});
        expect(saved).toEqual({id: 'fraction', x, y, w: 0.5, h: 0.5, ...constraints});
    },
);

test.each([1, 2])('nowrap moves retain subunit saved width with minW %s', (minW) => {
    const engine = new DashKitEngine({column: 12, maxRow: 4});
    engine.mode = {compactType: 'horizontal-nowrap', allowOverlap: true};
    const node = engine.addNode({id: 'fraction', x: 0, y: 0, w: 0.5, h: 0.5, minW, minH: 1});
    expect(engine.moveNodeCheck(node as (typeof engine.nodes)[number], {x: 3, y: 0})).toBe(true);
    expect(node).toMatchObject({x: 3, y: 0, w: 0.5, h: 0.5, minW, minH: 1});
    expect(engine.moveNodeCheck(node as (typeof engine.nodes)[number], {x: 11.5, y: 0})).toBe(true);
    expect(node).toMatchObject({x: 11.5, y: 0, w: 0.5, h: 0.5});
    expect(
        engine.moveNodeCheck(node as (typeof engine.nodes)[number], {w: 0.25, resizing: true}),
    ).toBe(false);
    expect(node).toMatchObject({x: 11.5, y: 0, w: 0.5, h: 0.5});
});

// Critical: yes. Finite row bounds must not hide a collision by clamping a pushed neighbour.
test('finite fit and move simulate collision overflow before rejecting atomically', () => {
    const engine = new DashKitEngine({column: 6, maxRow: 8, float: true});
    engine.mode = {compactType: null};
    const a = engine.addNode({id: 'a', x: 0, y: 0, w: 6, h: 4});
    engine.addNode({id: 'b', x: 0, y: 4, w: 6, h: 4});
    const before = nodes(engine);
    expect(engine.willItFit({id: 'incoming', x: 0, y: 4, w: 6, h: 4})).toBe(false);
    expect(engine.moveNodeCheck(a as (typeof engine.nodes)[number], {x: 0, y: 4})).toBe(false);
    expect(engine.maxRow).toBe(8);
    expect(nodes(engine)).toEqual(before);
});
