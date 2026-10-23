import type {Config, GridStackContainer} from '../../../shared';
import {validateConfig, validateGrid} from '../document';
import {getGridGeometry, getGridStackLayoutRects, visibleGeometry} from '../geometry';

const container: GridStackContainer = {
    id: 'box',
    x: 0,
    y: 0,
    w: 12,
    h: 10,
    padding: [12, 20, 24, 16],
    gap: [8, 6],
    grid: {cols: 12, rowHeight: 18, compactType: null},
};
const config: Config = {
    salt: 'test',
    counter: 1,
    aliases: {},
    connections: [],
    items: [{id: 'widget', type: 'test', namespace: 'default', data: {text: 'saved metadata'}}],
    layout: [{i: 'widget', x: 0.5, y: 1.25, w: 6, h: 4, containerId: 'box'}],
    containers: [container],
    layoutVersion: 2,
};

// Critical: yes. Rejecting a malformed parent graph prevents silent saved-content loss.
test('accepts additive nested data and rejects nonempty container removal without mutating input', () => {
    const saved = JSON.parse(JSON.stringify(config));
    expect(() => validateConfig(config)).not.toThrow();
    expect(() => validateConfig({...config, containers: []})).toThrow('move its children');
    expect(config).toEqual(saved);
});

test.each([
    [{...container, id: 'widget'}, 'duplicate'],
    [{...container, containerId: 'box'}, 'cyclic'],
    [{...container, containerId: 'missing'}, 'unknown'],
    [{...container, x: Infinity}, 'finite geometry'],
    [{...container, padding: [-1, 0, 0, 0]}, 'padding'],
    [{...container, grid: {...container.grid, cols: 0}}, 'grid settings'],
] as const)('rejects invalid nested graph or geometry', (entry, error) => {
    expect(() => validateConfig({...config, containers: [entry as GridStackContainer]})).toThrow(
        error,
    );
});

test('gap and padding produce independent visible geometry', () => {
    const grid = getGridGeometry(640, {
        cols: 12,
        rowHeight: 18,
        margin: [8, 6],
        containerPadding: [16, 12],
    });
    const first = visibleGeometry({x: 0, y: 0, w: 3, h: 2}, grid);
    const second = visibleGeometry({x: 3, y: 0, w: 3, h: 2}, grid);
    expect(second.left - first.left - first.width).toBeCloseTo(8);
    expect(first.height).toBe(42);
    expect(grid.paddingX).toBe(16);
    expect(grid.paddingY).toBe(12);
});

test('projection accumulates nested origin and padding without changing saved local geometry', () => {
    const saved = JSON.parse(JSON.stringify(config));
    const project = require('../geometry').getGridStackLayoutRects;
    const rects = project(config, {
        __default: {
            width: 640,
            gridProperties: {cols: 12, rowHeight: 18, margin: [8, 6], containerPadding: [0, 0]},
        },
    });
    // Parent visible width is 640. Child usable width is 604; column step is (604+8)/12 = 51.
    expect(rects.widget).toEqual({
        x: 16 + 0.5 * 51,
        y: 12 + 1.25 * 24,
        width: 6 * 51 - 8,
        height: 4 * 24 - 6,
    });
    expect(config).toEqual(saved);
});

test('projection preserves arbitrary legacy widget IDs as own serializable keys', () => {
    const special = {
        ...config,
        items: [{...config.items[0], id: '__proto__'}],
        layout: [{...config.layout[0], i: '__proto__'}],
    };
    const rects = getGridStackLayoutRects(special, {
        __default: {width: 640, gridProperties: {cols: 12, rowHeight: 18}},
    });
    expect(Object.keys(rects)).toEqual(['__proto__']);
    expect(Object.keys(JSON.parse(JSON.stringify(rects)))).toEqual(['__proto__']);
});

test('rejects present invalid membership and zero columns rather than defaulting them', () => {
    expect(() => validateGrid({cols: 0})).toThrow('grid');
    expect(() =>
        validateConfig({...config, layout: [{...config.layout[0], containerId: ''}]}),
    ).toThrow('containerId');
});

// Critical: yes. Malformed controlled content must fail before clipping/exporting saved children.
test.each([
    [{...container, h: 2, padding: [1000, 0, 1000, 0]}, config.layout, 'usable width or height'],
    [{...container, padding: [0, 640, 0, 1]}, config.layout, 'usable width or height'],
    [container, [{...config.layout[0], x: 10}], 'content bounds'],
    [container, [{...config.layout[0], y: 20}], 'content bounds'],
] as const)(
    'rejects impossible padding or child extents at the projection boundary',
    (box, layout, error) => {
        const invalid = {...config, containers: [box as GridStackContainer], layout: [...layout]};
        const before = JSON.stringify(invalid);
        expect(() =>
            getGridStackLayoutRects(invalid, {
                __default: {
                    width: 640,
                    gridProperties: {
                        cols: 12,
                        rowHeight: 18,
                        margin: [0, 0],
                        containerPadding: [0, 0],
                    },
                },
            }),
        ).toThrow(error);
        expect(JSON.stringify(invalid)).toBe(before);
    },
);
