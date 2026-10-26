import assert from 'node:assert/strict';

import type {Page} from '@playwright/test';

import type {Config} from '../../src/shared';

import {checked, storyUrl, test} from './fixtures';
import type {NativeElement} from './types';
// Critical: yes. Native edits must preserve saved geometry and a usable editor.
function boundary(page: Page) {
    const frames = () =>
        page.evaluate(
            () =>
                new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                ),
        );
    const snapshot = () =>
        page.evaluate(() => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            return {
                config: JSON.parse(
                    required(
                        required(document.querySelector<NativeElement>('[data-qa="saved-config"]'))
                            .textContent,
                    ),
                ) as Config,
                events: required(
                    required(document.querySelector<NativeElement>('[data-qa="event-count"]'))
                        .textContent,
                ),
                widgets: [...document.querySelectorAll<NativeElement>('[data-widget-id]')].map(
                    (el) => ({
                        id: el.dataset.widgetId,
                        instance: el.dataset.widgetInstance,
                        transform: el.closest<HTMLElement>('.dashkit-gridstack__host')?.style
                            .transform,
                        rect: el.getBoundingClientRect().toJSON(),
                    }),
                ),
                containers: [
                    ...document.querySelectorAll<NativeElement>('.dashkit-gridstack__container'),
                ].map((el) => ({
                    id: required(el.parentElement).dataset.dashkitId,
                    transform: required(el.parentElement).style.transform,
                    rect: el.getBoundingClientRect().toJSON(),
                })),
            };
        });
    const sameRects = (
        actual: Awaited<ReturnType<typeof snapshot>>,
        expected: Awaited<ReturnType<typeof snapshot>>,
    ) => {
        for (const key of ['widgets', 'containers'] as const) {
            for (const entry of expected[key]) {
                const next = actual[key].find(({id}) => id === entry.id);
                assert(next, `missing ${entry.id}`);
                for (const field of ['x', 'y', 'width', 'height'] as const) {
                    assert(
                        Math.abs(next.rect[field] - entry.rect[field]) < 0.01,
                        `${entry.id} ${field}: ${next.rect[field]} != ${entry.rect[field]}`,
                    );
                }
            }
        }
    };
    const dragTo = async (
        rect: {
            x: number;
            y: number;
            width: number;
            height: number;
            bottom: number;
        },
        destination: {
            x: number;
            y: number;
        },
    ) => {
        const x = rect.x + rect.width / 2,
            y = rect.bottom - 12;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 5, y + 5);
        await page.mouse.move(destination.x, destination.y, {steps: 16});
        const preview = await page.locator('[data-dashkit-id]').evaluateAll((elements) =>
            Object.fromEntries(
                elements.map((el) => {
                    const node = (el as NativeElement).gridstackNode;
                    return [
                        (el as HTMLElement).dataset.dashkitId,
                        {x: node.x, y: node.y, w: node.w, h: node.h},
                    ];
                }),
            ),
        );
        await page.mouse.up();
        await frames();
        return preview;
    };
    return {frames, snapshot, sameRects, dragTo};
}

test('subtree admission, undo, cancellation and nested palette', async ({page, evidence}) => {
    const {frames, snapshot, sameRects, dragTo} = boundary(page);
    await page.goto(storyUrl('bounded-subtrees'));
    await page.locator('[data-widget-id="b"]').waitFor();
    assert.equal(
        await page.locator('[data-dashkit-engine]').getAttribute('data-dashkit-engine'),
        'gridstack',
    );
    await page.getByRole('button', {name: 'Read refs', exact: true}).click();
    const refs = await page.locator('[data-qa="meta"]').textContent();
    const before = await snapshot();
    const right = await page.locator('[data-dashkit-id="target"] .grid-stack').boundingBox();
    await dragTo(checked(before.containers.find(({id}) => id === 'small')).rect, {
        x: checked(right).x + 70,
        y: checked(right).y + 90,
    });
    const inside = await snapshot();
    assert.equal(
        checked(checked(inside.config.containers).find(({id}) => id === 'small')).parent,
        'right',
    );
    assert.equal(
        checked(checked(inside.config.containers).find(({id}) => id === 'small')).containerId,
        'target',
    );
    assert.equal(
        checked(checked(inside.config.containers).find(({id}) => id === 'twig')).parent,
        'right',
    );
    assert(inside.config.layout.every(({parent}) => parent === 'right'));
    assert.deepEqual(
        inside.config.layout.map(({i, x, y, w, h, containerId}) => ({i, x, y, w, h, containerId})),
        before.config.layout.map(({i, x, y, w, h, containerId}) => ({i, x, y, w, h, containerId})),
    );
    assert.deepEqual(
        inside.widgets.map(({id, instance}) => [id, instance]),
        before.widgets.map(({id, instance}) => [id, instance]),
    );
    assert.equal(inside.events, 'Events: 1');
    await page.getByRole('button', {name: 'Read refs', exact: true}).click();
    assert.equal(await page.locator('[data-qa="meta"]').textContent(), refs);
    await page.getByRole('button', {name: 'Undo subtree', exact: true}).click();
    await frames();
    const undone = await snapshot();
    assert.deepEqual(undone.config, before.config);
    assert.equal(undone.events, 'Events: 1');
    await dragTo(checked(undone.containers.find(({id}) => id === 'small')).rect, {
        x: checked(right).x + 70,
        y: checked(right).y + 90,
    });
    const nestedAgain = await snapshot();
    const left = await page
        .locator('[data-boundary-zone="left"] > .dashkit-gridstack__zone > .grid-stack')
        .boundingBox();
    await dragTo(checked(nestedAgain.containers.find(({id}) => id === 'small')).rect, {
        x: checked(left).x + 80,
        y: checked(left).y + 90,
    });
    const outside = await snapshot();
    assert.equal(
        checked(checked(outside.config.containers).find(({id}) => id === 'small')).parent,
        'left',
    );
    assert.equal(
        checked(checked(outside.config.containers).find(({id}) => id === 'small')).containerId,
        undefined,
    );
    assert.equal(
        checked(checked(outside.config.containers).find(({id}) => id === 'twig')).parent,
        'left',
    );
    assert(outside.config.layout.every(({parent}) => parent === 'left'));
    assert.deepEqual(
        outside.config.layout,
        before.config.layout.map((entry) => {
            const layout: Config['layout'][number] & {
                minW?: number;
                minH?: number;
            } = {...entry};
            delete layout.minW;
            delete layout.minH;
            return layout;
        }),
    );
    assert.equal(outside.events, 'Events: 3');
    for (const destination of [
        {x: checked(right).x + 100, y: checked(right).y + 100},
        {x: checked(left).x + 340, y: checked(left).y + 150},
        {x: 800, y: 550},
    ]) {
        const current = await snapshot();
        const preview = await dragTo(
            checked(current.containers.find(({id}) => id === 'large')).rect,
            destination,
        );
        const applied = await snapshot();
        // Rejected destinations retain membership; release still commits the valid source preview.
        const expected = {
            ...current.config,
            containers: checked(current.config.containers).map((container) => ({
                ...container,
                ...preview[container.id],
            })),
        };
        assert.deepEqual(applied.config, expected);
        const changed = JSON.stringify(expected) !== JSON.stringify(current.config);
        assert.equal(
            applied.events,
            `Events: ${Number(current.events?.split(': ')[1]) + Number(changed)}`,
        );
        assert.deepEqual(
            applied.widgets.map(({id, instance}) => [id, instance]),
            current.widgets.map(({id, instance}) => [id, instance]),
        );
        if (changed) {
            await page.getByRole('button', {name: 'Undo subtree', exact: true}).click();
            await frames();
            const undonePreview = await snapshot();
            assert.deepEqual(undonePreview.config, current.config);
            sameRects(undonePreview, current);
        }
    }
    const cancelBefore = await snapshot();
    const cancelRect = checked(cancelBefore.containers.find(({id}) => id === 'small')).rect;
    const cx = cancelRect.x + cancelRect.width / 2,
        cy = cancelRect.bottom - 12;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 5, cy + 5);
    await page.mouse.move(checked(right).x + 70, checked(right).y + 90, {steps: 16});
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await frames();
    const rejected = await snapshot();
    assert.deepEqual(rejected.config, cancelBefore.config);
    assert.equal(rejected.events, cancelBefore.events);
    sameRects(rejected, cancelBefore);
    assert.deepEqual(
        rejected.widgets.map(({id, instance}) => [id, instance]),
        cancelBefore.widgets.map(({id, instance}) => [id, instance]),
    );
    const readyRect = checked(rejected.containers.find(({id}) => id === 'small')).rect;
    await dragTo(readyRect, {
        x: readyRect.x + readyRect.width / 2 + 35,
        y: readyRect.bottom - 12 + 20,
    });
    const nextGesture = await snapshot();
    const oldSmall = checked(rejected.config.containers).find(({id}) => id === 'small');
    const nextSmall = checked(nextGesture.config.containers).find(({id}) => id === 'small');
    assert.equal(
        checked(nextSmall).x,
        Math.min(checked(oldSmall).x + 35, checked(left).width - checked(oldSmall).w),
    );
    assert.equal(checked(nextSmall).y, checked(oldSmall).y + 20);
    assert.equal(nextGesture.events, `Events: ${Number(rejected.events?.split(': ')[1]) + 1}`);
    assert.deepEqual(nextGesture.config.layout, rejected.config.layout);
    assert.deepEqual(
        nextGesture.widgets.map(({id, instance}) => [id, instance]),
        rejected.widgets.map(({id, instance}) => [id, instance]),
    );
    await page.getByRole('button', {name: 'Undo subtree', exact: true}).click();
    await frames();
    const nextUndo = await snapshot();
    assert.deepEqual(nextUndo.config, rejected.config);
    sameRects(nextUndo, rejected);
    evidence.push({
        check: 'bounded native container subtree transfer converts source pixels before fit, preserves descendants/refs, one transaction, undo, Escape cancel, oversize admission rejection and outside/gap preview commit',
        before,
        inside,
        undone,
        outside,
        rejected,
        nextGesture,
        nextUndo,
    });
    const nestedBefore = await snapshot();
    await page.getByRole('button', {name: 'Palette allowed: true', exact: true}).click();
    const nestedTarget = page.locator('[data-dashkit-id="target"] .grid-stack');
    await page
        .getByRole('button', {name: '+ Widget', exact: true})
        .dragTo(nestedTarget, {targetPosition: {x: 150, y: 100}});
    assert.deepEqual((await snapshot()).config, nestedBefore.config);
    assert.equal(await page.locator('[data-qa="drop-count"]').textContent(), '0');
    await page.getByRole('button', {name: 'Palette allowed: false', exact: true}).click();
    const nestedSource = await page
        .getByRole('button', {name: '+ Widget', exact: true})
        .boundingBox();
    const nestedRoot = await nestedTarget.boundingBox();
    await page.mouse.move(
        checked(nestedSource).x + checked(nestedSource).width / 2,
        checked(nestedSource).y + checked(nestedSource).height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(checked(nestedRoot).x + 150, checked(nestedRoot).y + 100, {steps: 12});
    await page.mouse.move(checked(nestedRoot).x + 160, checked(nestedRoot).y + 100);
    await frames();
    await page.locator('[data-dashkit-id="__dropping-elem__"]').waitFor({state: 'visible'});
    assert.equal(await page.locator('[data-dashkit-id="__dropping-elem__"]').count(), 1);
    await page.mouse.move(850, 650, {steps: 8});
    await page.mouse.up();
    await frames();
    assert.equal(await page.locator('[data-dashkit-id="__dropping-elem__"]').count(), 0);
    assert.deepEqual((await snapshot()).config, nestedBefore.config);
    await page
        .getByRole('button', {name: '+ Widget', exact: true})
        .dragTo(nestedTarget, {targetPosition: {x: 150, y: 100}});
    const nestedCommit = await snapshot();
    assert.equal(nestedCommit.config.items.length, 3);
    assert.equal(nestedCommit.events, nestedBefore.events);
    assert.equal(await page.locator('[data-qa="drop-count"]').textContent(), '1');
    assert.deepEqual(nestedCommit.config.layout.slice(0, 2), nestedBefore.config.layout);
    assert.equal(nestedCommit.config.layout[2].containerId, 'target');
    assert.equal(nestedCommit.config.layout[2].parent, 'right');
    assert.equal(await page.locator('[data-dashkit-id="__dropping-elem__"]').count(), 0);
    evidence.push({
        check: 'nested palette validator false and cancel leave no preview, membership/geometry or callback changes before one valid destination commit',
        nestedBefore,
        nestedCommit,
    });
});

test('hidden finite canvas reveals without remount and accepts the next resize', async ({
    page,
    evidence,
}) => {
    const {frames, snapshot} = boundary(page);
    await page.goto(storyUrl('finite-nowrap'));
    await page.locator('[data-widget-id="a"]').waitFor();
    await page.getByRole('button', {name: 'Remove b', exact: true}).click();
    await frames();
    const visible = await snapshot();
    const content = await page.locator('[data-widget-id="a"]').getAttribute('data-widget-renders');
    await page.locator('[data-widget-id="a"]').evaluate((el) => {
        (
            window as Window & {
                __boundaryWidget?: Element;
            }
        ).__boundaryWidget = el;
    });
    await page.locator('[data-qa="contract-canvas"]').evaluate((el) => {
        el.style.setProperty('display', 'none');
    });
    await frames();
    await frames();
    await page.locator('[data-qa="contract-canvas"]').evaluate((el) => {
        el.style.removeProperty('display');
    });
    await frames();
    await frames();
    const revealed = await snapshot();
    assert.deepEqual(revealed.config, visible.config);
    assert.equal(revealed.events, visible.events);
    assert.equal(
        await page.locator('[data-widget-id="a"]').evaluate(
            (el) =>
                el ===
                (
                    window as Window & {
                        __boundaryWidget?: Element;
                    }
                ).__boundaryWidget,
        ),
        true,
    );
    assert.equal(
        await page.locator('[data-widget-id="a"]').getAttribute('data-widget-renders'),
        content,
    );
    assert.equal(revealed.widgets[0].rect.width, visible.widgets[0].rect.width);
    evidence.push({
        check: 'zero-width hidden to visible settles with identical content node/render count, config and no echo',
        visible,
        revealed,
    });
    const a = checked(revealed.widgets.find(({id}) => id === 'a')).rect;
    const handle = await page.locator('[data-dashkit-id="a"] .ui-resizable-se').boundingBox();
    const hx = checked(handle).x + checked(handle).width / 2,
        hy = checked(handle).y + checked(handle).height / 2;
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(hx + 5, hy);
    await page.mouse.move(hx + 54, hy, {steps: 8});
    await page.mouse.up();
    await frames();
    const afterRevealDrag = await snapshot();
    assert.equal(afterRevealDrag.events, 'Events: 1');
    assert.equal(afterRevealDrag.config.layout[0].w, 9);
    assert.equal(afterRevealDrag.widgets[0].rect.width - a.width, 54);
    evidence.push({
        check: 'first native gesture after zero-width reveal uses settled geometry',
        afterRevealDrag,
    });
});

test('horizontal packing matches legacy public reflow', async ({page, evidence}) => {
    const {frames, snapshot} = boundary(page);
    await page.goto(storyUrl('horizontal-packing'));
    await page.locator('[data-widget-id="b"]').waitFor();
    const golden = JSON.parse(
        checked(await page.locator('[data-qa="legacy-reflow"]').textContent()),
    ) as Config['layout'];
    await page.getByRole('button', {name: 'Compact', exact: true}).click();
    await frames();
    const horizontal = await snapshot();
    assert.deepEqual(horizontal.config.layout, golden);
    const packedA = horizontal.config.layout.find(({i}) => i === 'a');
    const packedB = horizontal.config.layout.find(({i}) => i === 'b');
    assert.equal(Math.max(checked(packedA).y, checked(packedB).y), 2);
    const upper = checked(
        horizontal.widgets.find(
            ({id}) => id === (checked(packedA).y < checked(packedB).y ? 'a' : 'b'),
        ),
    ).rect;
    const lower = checked(
        horizontal.widgets.find(
            ({id}) => id === (checked(packedA).y < checked(packedB).y ? 'b' : 'a'),
        ),
    ).rect;
    assert(lower.top >= upper.bottom + 6);
    evidence.push({
        check: 'native horizontal gaps and overflow row-wrap match actual legacy public reflow exactly',
        golden,
        horizontal,
    });
});

test('finite nowrap rejects unavailable palette space and commits valid drops', async ({
    page,
    evidence,
}) => {
    const {frames, snapshot} = boundary(page);
    await page.goto(storyUrl('finite-nowrap'));
    await page.locator('[data-widget-id="b"]').waitFor();
    const full = await snapshot();
    const fullHandle = await page.locator('[data-dashkit-id="a"] .ui-resizable-se').boundingBox();
    const fx = checked(fullHandle).x + checked(fullHandle).width / 2,
        fy = checked(fullHandle).y + checked(fullHandle).height / 2;
    await page.mouse.move(fx, fy);
    await page.mouse.down();
    await page.mouse.move(fx + 5, fy);
    await page.mouse.move(fx + 108, fy, {steps: 8});
    await page.mouse.up();
    await frames();
    assert.deepEqual((await snapshot()).config, full.config);
    assert.equal((await snapshot()).events, full.events);
    await page
        .getByRole('button', {name: '+ Widget', exact: true})
        .dragTo(page.locator('.grid-stack').first(), {targetPosition: {x: 450, y: 30}});
    const noSpace = await snapshot();
    assert.deepEqual(noSpace.config, full.config);
    assert.equal(noSpace.events, full.events);
    assert.equal(await page.locator('[data-dashkit-id="__dropping-elem__"]').count(), 0);
    await page.getByRole('button', {name: 'Remove b', exact: true}).click();
    await frames();
    await page.getByRole('button', {name: 'Palette allowed: true', exact: true}).click();
    const available = await snapshot();
    await page
        .getByRole('button', {name: '+ Widget', exact: true})
        .dragTo(page.locator('.grid-stack').first(), {targetPosition: {x: 450, y: 30}});
    assert.deepEqual((await snapshot()).config, available.config);
    assert.equal(await page.locator('[data-dashkit-id="__dropping-elem__"]').count(), 0);
    await page.getByRole('button', {name: 'Palette allowed: false', exact: true}).click();
    const source = await page.getByRole('button', {name: '+ Widget', exact: true}).boundingBox();
    const root = await page.locator('.grid-stack').first().boundingBox();
    await page.mouse.move(
        checked(source).x + checked(source).width / 2,
        checked(source).y + checked(source).height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(checked(root).x + 450, checked(root).y + 30, {steps: 12});
    await page.mouse.move(checked(root).x + 460, checked(root).y + 30);
    await frames();
    await page.locator('[data-dashkit-id="__dropping-elem__"]').waitFor({state: 'visible'});
    assert.equal(await page.locator('[data-dashkit-id="__dropping-elem__"]').count(), 1);
    await page.mouse.move(850, 650, {steps: 8});
    await page.mouse.up();
    await frames();
    assert.equal(await page.locator('[data-dashkit-id="__dropping-elem__"]').count(), 0);
    assert.deepEqual((await snapshot()).config, available.config);
    await page
        .getByRole('button', {name: '+ Widget', exact: true})
        .dragTo(page.locator('.grid-stack').first(), {targetPosition: {x: 450, y: 30}});
    const committed = await snapshot();
    assert.equal(committed.config.items.length, 2);
    assert.equal(committed.events, 'Events: 0');
    assert.equal(await page.locator('[data-qa="drop-count"]').textContent(), '1');
    assert.equal(
        committed.config.layout.reduce((sum, entry) => sum + entry.w, 0),
        12,
    );
    assert(committed.config.layout.every(({y, h}) => y === 0 && h === 2));
    assert.equal(await page.locator('[data-dashkit-id="__dropping-elem__"]').count(), 0);
    evidence.push({
        check: 'finite nowrap native no-space drop, validator false, canceled preview cleanup then valid commit consumes only remaining width',
        full,
        noSpace,
        available,
        committed,
    });
});

test('live scale continuation matches legacy geometry', async ({page, evidence}) => {
    const {frames, snapshot} = boundary(page);
    await page.setViewportSize({width: 1800, height: 1200});
    await page.goto(storyUrl('report-canvas'));
    await page.locator('[data-widget-id="b"]').waitFor();
    const liveBefore = await snapshot();
    const b = checked(liveBefore.widgets.find(({id}) => id === 'b')).rect;
    const sx = b.x + 30,
        sy = b.y + 60;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 5, sy + 5);
    await page.mouse.move(sx + 45, sy + 35, {steps: 8});
    assert.equal(await page.locator('.ui-draggable-dragging').count(), 1);
    // Change the public mutable ref/CSS through the fixture while the native pointer stays down.
    await page
        .getByRole('button', {name: 'Ref2', exact: true})
        .evaluate((el) => (el as HTMLElement).click());
    await page.mouse.move(sx + 65, sy + 45);
    await frames();
    const nodePosition = () =>
        page.locator('[data-dashkit-id="b"]').evaluate((el) => ({
            x: (el as NativeElement).gridstackNode.x,
            y: (el as NativeElement).gridstackNode.y,
            w: (el as NativeElement).gridstackNode.w,
            h: (el as NativeElement).gridstackNode.h,
        }));
    const live1 = await nodePosition();
    await page.mouse.move(sx + 105, sy + 65, {steps: 4});
    await frames();
    const live2 = await nodePosition();
    assert.equal(live2.x - live1.x, 20);
    assert.equal(live2.y - live1.y, 10);
    await page.mouse.up();
    await frames();
    const liveAfter = await snapshot();
    assert.equal(liveAfter.events, 'Events: 1');
    assert.deepEqual(
        liveAfter.config.layout.find(({i}) => i === 'a'),
        liveBefore.config.layout.find(({i}) => i === 'a'),
    );
    assert.deepEqual(
        liveAfter.widgets.map(({id, instance}) => [id, instance]),
        liveBefore.widgets.map(({id, instance}) => [id, instance]),
    );
    assert.deepEqual(
        Object.fromEntries(
            (Object.keys(live2) as Array<keyof typeof live2>).map((key) => [
                key,
                checked(liveAfter.config.layout.find(({i}) => i === 'b'))[key],
            ]),
        ),
        live2,
    );
    evidence.push({
        check: 'live mutable scaleRef1->2 during active native drag converts later40x20 screen delta to20x10 units and commits once',
        liveBefore,
        live1,
        live2,
        liveAfter,
    });
    await page.goto(storyUrl('legacy-scale-continuation'));
    await page.locator('[data-widget-id="b"]').waitFor();
    assert.equal(
        await page.locator('[data-dashkit-engine]').getAttribute('data-dashkit-engine'),
        'legacy',
    );
    const legacyStart = await snapshot();
    const legacyB = checked(legacyStart.widgets.find(({id}) => id === 'b')).rect;
    const lx = legacyB.x + 30,
        ly = legacyB.y + 60;
    await page.mouse.move(lx, ly);
    await page.mouse.down();
    await page.mouse.move(lx + 5, ly + 5);
    await page.mouse.move(lx + 45, ly + 35, {steps: 8});
    await page
        .getByRole('button', {name: 'Ref2', exact: true})
        .evaluate((el) => (el as HTMLElement).click());
    await page.mouse.move(lx + 65, ly + 45);
    await frames();
    const localRect = () =>
        page.locator('[data-widget-id="b"]').evaluate((el) => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            const rect = el.getBoundingClientRect(),
                gridRect = required(el.closest('.react-grid-layout')).getBoundingClientRect();
            return {
                x: (rect.x - gridRect.x) / 2,
                y: (rect.y - gridRect.y) / 2,
                width: rect.width / 2,
                height: rect.height / 2,
            };
        });
    const legacy1 = await localRect();
    // Let React commit each native move before the next delta is calculated.
    for (let step = 1; step <= 4; step++) {
        await page.mouse.move(lx + 65 + step * 10, ly + 45 + step * 5);
        await frames();
    }
    const legacy2 = await localRect();
    await page.mouse.up();
    await frames();
    assert.equal(legacy2.x - legacy1.x, live2.x - live1.x);
    assert.equal(legacy2.y - legacy1.y, live2.y - live1.y);
    assert.equal(legacy2.width, live2.w);
    assert.equal(legacy2.height, live2.h);
    evidence.push({
        check: 'actual legacy/new live zoom continuation agrees on20x10 unscaled delta and unchanged size (native activation thresholds recorded separately)',
        legacy1,
        legacy2,
        legacyAfter: await snapshot(),
        gridstack1: live1,
        gridstack2: live2,
    });
});

test('StrictMode reorder, unmount and remount retain current refs', async ({page, evidence}) => {
    const {snapshot} = boundary(page);
    await page.setViewportSize({width: 1000, height: 1000});
    await page.goto(storyUrl('strict-lifecycle'));
    await page.locator('[data-widget-id="a"]').waitFor();
    await page.getByRole('button', {name: 'Read refs', exact: true}).click();
    await page.waitForFunction(() => {
        function required<T>(value: T | null | undefined): T {
            if (value === null || value === undefined) {
                throw new Error('Missing native fixture value');
            }
            return value;
        }
        return (
            JSON.parse(
                required(
                    required(document.querySelector<NativeElement>('[data-qa="meta"]')).textContent,
                ),
            ).length === 2
        );
    });
    const strictMeta = JSON.parse(checked(await page.locator('[data-qa="meta"]').textContent()));
    const strictBefore = await snapshot();
    const oldHost = await page.locator('[data-dashkit-id="a"]').elementHandle();
    const oldRoot = await page.locator('.grid-stack').first().elementHandle();
    await page.getByRole('button', {name: 'Reverse layers', exact: true}).click();
    await page.getByRole('button', {name: 'Read refs', exact: true}).click();
    assert.deepEqual(
        JSON.parse(checked(await page.locator('[data-qa="meta"]').textContent())),
        [...strictMeta].reverse(),
    );
    await page.getByRole('button', {name: 'Toggle mount', exact: true}).click();
    assert.equal(await page.locator('[data-dashkit-engine]').count(), 0);
    assert.equal(
        await checked(oldRoot).evaluate((el) => (el as NativeElement).gridstack === undefined),
        true,
    );
    assert.equal(
        await checked(oldHost).evaluate(
            (el) => !(el as NativeElement).ddElement?.ddDraggable && !el.isConnected,
        ),
        true,
    );
    await page.getByRole('button', {name: 'Toggle mount', exact: true}).click();
    await page.locator('[data-widget-id="a"]').waitFor();
    await page.getByRole('button', {name: 'Read refs', exact: true}).click();
    await page.waitForFunction(() => {
        function required<T>(value: T | null | undefined): T {
            if (value === null || value === undefined) {
                throw new Error('Missing native fixture value');
            }
            return value;
        }
        return (
            JSON.parse(
                required(
                    required(document.querySelector<NativeElement>('[data-qa="meta"]')).textContent,
                ),
            ).length === 2
        );
    });
    const strictAfter = await snapshot();
    assert.equal(await page.locator('[data-dashkit-id="a"]').count(), 1);
    assert.equal(await page.locator('[data-dashkit-id="b"]').count(), 1);
    assert.notEqual(
        checked(strictAfter.widgets.find(({id}) => id === 'a')).instance,
        checked(strictBefore.widgets.find(({id}) => id === 'a')).instance,
    );
    assert.equal(strictAfter.events, 'Events: 0');
    evidence.push({
        check: 'actual new-component StrictMode retains current refs on controlled reorder, unmount destroys native DD/grid and remount registers once',
        strictBefore,
        strictMeta,
        strictAfter,
    });
});
