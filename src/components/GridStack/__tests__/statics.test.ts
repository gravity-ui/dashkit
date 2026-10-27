/** @jest-environment jsdom */
import type {Config, ConfigLayout, GridStackContainer} from '../../../shared';
import type {CompactType, DashKitGroup} from '../../../typings';
import {DashKit} from '../../DashKit/DashKit';
import {DashKitGridStack} from '../DashKitGridStack';
import {DashKitEngine} from '../engine';

const type = 'gridstack-static-boundaries';
DashKitGridStack.reloadPlugins({
    type,
    renderer: () => null,
    defaultLayout: {w: 4, h: 2, minW: 1, minH: 1},
});
const groups = (compactType: CompactType): DashKitGroup[] => [
    {gridProperties: () => ({cols: 12, compactType})},
];
const box: GridStackContainer = {
    id: 'box',
    x: 0,
    y: 0,
    w: 12,
    h: 6,
    padding: [0, 0, 0, 0],
    gap: [0, 0],
    grid: {cols: 12, rowHeight: 18, compactType: null},
};
const config: Config = {
    salt: 'statics',
    counter: 1,
    items: [],
    layout: [],
    aliases: {},
    connections: [],
    containers: [box],
};
const rects = (layout: ConfigLayout[]) => layout.map(({i, x, y, w, h}) => ({i, x, y, w, h}));

const child = {i: 'child', containerId: 'box', x: 1, y: 1, w: 2, h: 2};
// Critical: yes. Invalid saved membership must fail before reflow can generate a corrupt document.
test.each<[string, ConfigLayout[], GridStackContainer[], string]>([
    [
        'unknown immediate membership',
        [{...child, containerId: 'missing'}],
        [box],
        'unknown container "missing"',
    ],
    [
        'unknown ancestor',
        [child],
        [{...box, containerId: 'missing'}],
        'unknown container "missing"',
    ],
    ['membership without descriptors', [child], [], 'unknown container "box"'],
    [
        'cycle',
        [child],
        [
            {...box, containerId: 'inner'},
            {...box, id: 'inner', containerId: 'box'},
        ],
        'cyclic container membership',
    ],
    ['unused cycle', [], [{...box, containerId: 'box'}], 'cyclic container membership'],
    ['duplicate containers', [child], [box, {...box}], 'duplicate or reserved id "box"'],
    ['widget/container collision', [{...child, i: 'box'}], [box], 'duplicate or reserved id "box"'],
    ['duplicate widgets', [child, {...child}], [box], 'duplicate or reserved id "child"'],
    ['empty membership', [{...child, containerId: ''}], [box], 'invalid containerId'],
    ['inconsistent zone', [{...child, parent: 'other'}], [box], 'inconsistent root zone'],
    ['reserved container', [], [{...box, id: '__default'}], 'duplicate or reserved id'],
    ['invalid spacing', [child], [{...box, gap: [-1, 0]}], 'padding and gap'],
    ['invalid grid', [child], [{...box, grid: {...box.grid, cols: 0}}], 'grid settings'],
    ['invalid nested geometry', [{...child, x: -1}], [box], 'invalid finite geometry'],
])(
    'public reflow rejects %s before settings or engine work without changing input',
    (_name, layout, containers, error) => {
        const gridProperties = jest.fn(() => ({cols: 12}));
        const options = {layout, containers, groups: [{gridProperties}]};
        const before = JSON.stringify(options);
        const update = jest.spyOn(DashKitEngine.prototype, 'batchUpdate');
        try {
            expect(() => DashKitGridStack.reflowLayout(options)).toThrow(error);
            expect(gridProperties).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
            expect(JSON.stringify(options)).toBe(before);
        } finally {
            update.mockRestore();
        }
    },
);

test('public reflow validates incoming membership and preserves valid nested fractions and descriptors', () => {
    const inner: GridStackContainer = {
        ...box,
        id: 'inner',
        containerId: 'box',
        h: 4,
        padding: [4, 4, 4, 4],
        gap: [2, 2],
        grid: {...box.grid, maxRows: 2.75},
    };
    const options = {
        layout: [{...child, containerId: 'inner', x: 0.5, y: 0.5, h: 1.5}],
        newLayoutItem: {...child, i: 'new', containerId: 'inner', x: 4, y: 0.25, h: 1.25},
        containers: [{...box, h: 10}, inner],
        groups: groups(null),
    };
    const before = JSON.stringify(options);
    expect(DashKitGridStack.reflowLayout(options)).toEqual([
        ...options.layout,
        options.newLayoutItem,
    ]);
    expect(JSON.stringify(options)).toBe(before);
    expect(options.containers[0].grid.maxRows).toBeUndefined();
    expect(() =>
        DashKitGridStack.reflowLayout({
            ...options,
            newLayoutItem: {...options.newLayoutItem, containerId: 'missing'},
        }),
    ).toThrow('unknown container "missing"');
});

test('nested setItem normalizes legitimate infinite plugin defaults before reflow validation', () => {
    const infiniteType = `${type}-infinite`;
    DashKitGridStack.reloadPlugins({
        type: infiniteType,
        renderer: () => null,
        defaultLayout: {x: 0, y: Infinity, w: Infinity, h: 2, minW: 1, minH: 1},
    });
    const next = DashKitGridStack.setItem({
        config,
        item: {
            type: infiniteType,
            data: {},
            layout: {x: 0, y: Infinity, w: Infinity, h: 2, containerId: 'box'},
        },
        groups: groups(null),
        options: {updateLayout: []},
    });
    expect(next.layout[0]).toMatchObject({x: 0, y: 0, w: 12, h: 2, containerId: 'box'});
    expect(next.containers).toEqual(config.containers);
});

// Critical: yes. Helpers generate saved geometry; overlapping containers can hide existing content.
test('append and reflow treat empty and occupied sibling containers as immutable footprints', () => {
    const before = JSON.stringify(config);
    const added = DashKitGridStack.setItem({
        config,
        item: {type, data: {}},
        groups: groups('vertical'),
    });
    expect(added.layout[0]).toMatchObject({x: 0, y: 6, w: 4, h: 2});
    expect(added.containers).toEqual([box]);
    const layout = [
        {i: 'child', containerId: 'box', x: 0, y: 0, w: 4, h: 2},
        {i: 'outside', x: 0, y: 10, w: 4, h: 2},
    ];
    expect(
        DashKitGridStack.reflowLayout({layout, containers: [box], groups: groups('vertical')}),
    ).toEqual([layout[0], {...layout[1], y: 6}]);
    expect(JSON.stringify(config)).toBe(before);
    const beside = {...box, w: 6};
    expect(
        DashKitGridStack.reflowLayout({
            layout: [{i: 'a', x: 8, y: 4, w: 4, h: 2}],
            containers: [beside],
            groups: groups('horizontal'),
        }),
    ).toEqual([{i: 'a', x: 6, y: 4, w: 4, h: 2}]);
    expect(beside).toEqual({...box, w: 6});
});

const fixtures: ConfigLayout[][] = [
    [
        {i: 'a', x: 0, y: 0, w: 3, h: 1},
        {i: 'b', x: 0, y: 0, w: 3, h: 1},
    ],
    [
        {i: 'a', x: 0, y: 0, w: 8, h: 2},
        {i: 'b', x: 2, y: 0, w: 6, h: 2},
        {i: 'c', x: 4, y: 0, w: 4, h: 1},
    ],
    [
        {i: 'a', x: 4, y: 2, w: 4, h: 2},
        {i: 'b', x: 9, y: 0, w: 3, h: 3},
        {i: 'c', x: 8, y: 2, w: 4, h: 2},
    ],
];
// Critical: yes. Same public operation must not rearrange a user's saved dashboard differently.
test.each(['vertical', 'horizontal', 'horizontal-nowrap'] as const)(
    '%s public reflow preserves legacy collision, gaps and row-wrap priority',
    (compactType) => {
        for (const layout of fixtures) {
            const input = JSON.stringify(layout);
            const options = {layout, groups: groups(compactType)};
            expect(rects(DashKitGridStack.reflowLayout(options))).toEqual(
                rects(
                    DashKit.reflowLayout({...options, layout: layout.map((entry) => ({...entry}))}),
                ),
            );
            const newLayoutItem = {i: 'new', x: 0, y: 0, w: 4, h: 2};
            expect(rects(DashKitGridStack.reflowLayout({...options, newLayoutItem}))).toEqual(
                rects(
                    DashKit.reflowLayout({
                        ...options,
                        layout: layout.map((entry) => ({...entry})),
                        newLayoutItem: {...newLayoutItem},
                    }),
                ),
            );
            expect(JSON.stringify(layout)).toBe(input);
        }
    },
);

test.each(['vertical', 'horizontal'] as const)(
    '%s setItem keeps new-item priority and canonical saved order',
    (compactType) => {
        const original: Config = {
            ...config,
            containers: undefined,
            items: [{id: 'old', type, namespace: 'default', data: {}}],
            layout: [{i: 'old', x: 0, y: 0, w: 4, h: 2}],
        };
        const options = {
            config: original,
            item: {type, data: {}, layout: {x: 0, y: 0, w: 4, h: 2}},
            groups: groups(compactType),
        };
        const legacy = DashKit.setItem(options);
        const next = DashKitGridStack.setItem(options);
        expect(next.items).toEqual(legacy.items);
        expect(rects(next.layout)).toEqual(rects(legacy.layout));
        expect(next.layout.map(({i}) => i)).toEqual(next.items.map(({id}) => id));
    },
);

// Critical: yes. No-space insertion must not persist an overflowed second row.
test('finite nowrap insertion budgets sibling widgets and containers and rejects a full row', () => {
    const full = {...config, containers: [{...box, w: 12}]};
    const input = JSON.stringify(full);
    expect(() =>
        DashKitGridStack.setItem({
            config: full,
            item: {type, data: {}},
            groups: groups('horizontal-nowrap'),
        }),
    ).toThrow('no space');
    expect(JSON.stringify(full)).toBe(input);
    const available = {...config, containers: [{...box, w: 9}]};
    const next = DashKitGridStack.setItem({
        config: available,
        item: {type, data: {}},
        groups: groups('horizontal-nowrap'),
    });
    expect(next.layout[0]).toMatchObject({x: 9, y: 0, w: 3, h: 2});
    expect(next.containers).toEqual(available.containers);
});

// Critical: yes. Legacy helpers must reject nested input before dropping its membership.
test('legacy static entry points reject incoming nested membership while new reflow and flat legacy remain valid', () => {
    const newLayoutItem = {i: 'incoming', x: 0, y: 0, w: 1, h: 1, containerId: 'box'};
    expect(() => DashKit.reflowLayout({layout: [], newLayoutItem})).toThrow(
        'requires @gravity-ui/dashkit/gridstack',
    );
    const flat = {...config, containers: undefined};
    expect(() =>
        DashKit.setItem({config: flat, item: {type, data: {}, layout: newLayoutItem}}),
    ).toThrow('requires @gravity-ui/dashkit/gridstack');
    expect(() =>
        DashKit.setItem({
            config: flat,
            item: {type, data: {}},
            options: {updateLayout: [newLayoutItem]},
        }),
    ).toThrow('requires @gravity-ui/dashkit/gridstack');
    expect(
        DashKit.reflowLayout({layout: [], newLayoutItem: {i: 'incoming', x: 0, y: 0, w: 1, h: 1}}),
    ).toEqual([{i: 'incoming', x: 0, y: 0, w: 1, h: 1}]);
    expect(DashKitGridStack.reflowLayout({layout: [], newLayoutItem, containers: [box]})).toEqual([
        newLayoutItem,
    ]);
});

// Plugin defaults must be checked before legacy addItem can persist or erase membership.
test.each([Infinity, 0])('legacy setItem rejects nested y=%s, accepts flat override', (y) => {
    const nestedType = `${type}-legacy-default-${y}`;
    DashKit.reloadPlugins({
        type: nestedType,
        renderer: () => null,
        defaultLayout: {w: 1, h: 1, y, containerId: 'box'},
    });
    const flat = {...config, containers: undefined};
    const item = {type: nestedType, data: {}};
    const before = JSON.stringify({flat, item});

    expect(() => DashKit.setItem({config: flat, item})).toThrow(
        'requires @gravity-ui/dashkit/gridstack',
    );
    expect(JSON.stringify({flat, item})).toBe(before);

    const override = {
        type: nestedType,
        data: {},
        layout: {x: 0, y, w: 1, h: 1, containerId: undefined},
    };
    const beforeOverride = {...override, layout: {...override.layout}};
    const next = DashKit.setItem({config: flat, item: override});
    expect(next.layout[0].containerId).toBeUndefined();
    expect(override).toStrictEqual(beforeOverride);
    expect(JSON.stringify({flat, item})).toBe(before);
});

// Critical: yes. Static admission must not generate a saved child beyond its physical parent.
test.each([undefined, 2, 100])(
    'nested static admission respects physical and configured maxRows %s',
    (maxRows) => {
        const nested = {
            ...config,
            containers: [
                {
                    ...box,
                    h: 4,
                    padding: [4, 0, 6, 0] as [number, number, number, number],
                    gap: [0, 6] as [number, number],
                    grid: {...box.grid, maxRows},
                },
            ],
        };
        const grid: DashKitGroup[] = [
            {gridProperties: () => ({cols: 12, rowHeight: 18, margin: [0, 2], compactType: null})},
        ];
        // 4*20-2-4-6 = 68px content, with child step24/gap6 => 74/24 rows.
        const limit = Math.min(maxRows ?? Infinity, 74 / 24);
        const added = DashKitGridStack.setItem({
            config: nested,
            groups: grid,
            item: {type, data: {}, layout: {x: 0, y: 0, w: 2, h: limit, containerId: 'box'}},
        });
        expect(added.layout[0].h).toBe(limit);
        expect(added.containers).toEqual(nested.containers);
        expect(() =>
            DashKitGridStack.setItem({
                config: nested,
                groups: grid,
                item: {
                    type,
                    data: {},
                    layout: {x: 0, y: 0, w: 2, h: limit + 1, containerId: 'box'},
                },
            }),
        ).toThrow('exceeds its container content bounds');
        expect(() =>
            DashKitGridStack.setItem({
                config: {...added, layout: [{...added.layout[0], h: limit + 1}]},
                groups: grid,
                item: added.items[0],
            }),
        ).toThrow('exceeds its container content bounds');
        expect(() =>
            DashKitGridStack.reflowLayout({
                groups: grid,
                containers: nested.containers,
                layout: [{i: 'invalid', x: 0, y: 1, w: 2, h: limit, containerId: 'box'}],
            }),
        ).toThrow('exceeds its container content bounds');
        expect(nested.layout).toEqual([]);
    },
);

// Critical: yes. Unrelated public edits must not silently enlarge valid fractional saved geometry.
test.each([undefined, 'box', 'inner'])(
    'reflow and setItem preserve sub-unit saved geometry in %s without mutating callers',
    (containerId) => {
        const containers: GridStackContainer[] = [
            {...box, x: 0, y: 0, w: 6, h: 6},
            {...box, id: 'inner', containerId: 'box', x: 6, y: 0, w: 6, h: 4},
        ];
        const fraction = {i: 'fraction', x: 11.5, y: 0.5, w: 0.5, h: 0.5, containerId};
        const untouched = {i: 'untouched', x: 8, y: 8, w: 2, h: 2};
        const document: Config = {
            ...config,
            containers,
            items: ['fraction', 'untouched'].map((id) => ({
                id,
                type,
                namespace: 'default',
                data: {},
            })),
            layout: [fraction, untouched],
        };
        const input = JSON.stringify(document);
        const incoming = {i: 'incoming', x: 8, y: 12, w: 1, h: 1};
        expect(
            DashKitGridStack.reflowLayout({
                layout: document.layout,
                containers,
                groups: groups(null),
            }),
        ).toEqual(document.layout);
        expect(
            DashKitGridStack.reflowLayout({
                layout: document.layout,
                containers,
                groups: groups(null),
                newLayoutItem: incoming,
            }),
        ).toEqual([...document.layout, incoming]);
        const next = DashKitGridStack.setItem({
            config: document,
            groups: groups(null),
            item: {type, data: {}, layout: incoming},
        });
        expect(next.layout.slice(0, 2)).toEqual(document.layout);
        expect(next.layout[2]).toMatchObject({x: 8, y: 12, w: 1, h: 1});
        expect(next.containers).toEqual(containers);
        expect(next.items.slice(0, 2)).toEqual(document.items);
        expect(JSON.stringify(document)).toBe(input);
        expect(incoming).toEqual({i: 'incoming', x: 8, y: 12, w: 1, h: 1});
    },
);

// Critical: yes. A valid child in a sub-unit physical row budget must remain saveable after reflow.
test('fractional geometry fits a container with less than one row of physical capacity', () => {
    const grid: DashKitGroup[] = [
        {
            gridProperties: () => ({
                cols: 12,
                rowHeight: 40,
                margin: [0, 0],
                containerPadding: [0, 0],
                compactType: null,
            }),
        },
    ];
    const containers = [{...box, h: 0.75, grid: {...box.grid, rowHeight: 40}}];
    const layout = [{i: 'fraction', containerId: 'box', x: 11.5, y: 0.25, w: 0.5, h: 0.5}];
    const document: Config = {
        ...config,
        containers,
        layout,
        items: [{id: 'fraction', type, namespace: 'default', data: {}}],
    };
    const before = JSON.stringify(document);
    expect(DashKitGridStack.reflowLayout({layout, containers, groups: grid})).toEqual(layout);
    const next = DashKitGridStack.setItem({
        config: document,
        groups: grid,
        item: {type, data: {}, layout: {x: 0, y: 2, w: 1, h: 1}},
    });
    expect(next.layout[0]).toEqual(layout[0]);
    expect(next.containers).toEqual(containers);
    expect(JSON.stringify(document)).toBe(before);
});

// Critical: yes. Legacy entry points must fail before silently flattening a saved document.
test.each([
    {layoutVersion: 2 as const},
    {containers: [box]},
    {layout: [{i: 'a', x: 0, y: 0, w: 1, h: 1, containerId: 'box'}]},
])('legacy render and static entry points reject nested documents: %j', (extra) => {
    const nested: Config = {...config, containers: undefined, ...extra};
    const before = JSON.stringify(nested);
    expect(() =>
        new DashKit({...DashKit.defaultProps, config: nested, editMode: true}).render(),
    ).toThrow('requires @gravity-ui/dashkit/gridstack');
    expect(() => DashKit.setItem({config: nested, item: {type, data: {}}})).toThrow(
        'requires @gravity-ui/dashkit/gridstack',
    );
    expect(() => DashKit.removeItem({config: nested, id: 'a', itemsStateAndParams: {}})).toThrow(
        'requires @gravity-ui/dashkit/gridstack',
    );
    expect(() => DashKit.reflowLayout({...nested})).toThrow(
        'requires @gravity-ui/dashkit/gridstack',
    );
    expect(JSON.stringify(nested)).toBe(before);
});
