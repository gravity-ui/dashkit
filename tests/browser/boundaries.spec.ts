import assert from 'node:assert/strict';

import type {Config} from '../../src/shared';

import {boundary, strictLifecycle} from './boundary-utils';
import {checked, storyUrl, test} from './fixtures';
import type {NativeElement} from './types';
test('subtree admission, undo and cancellation', async ({page, evidence}) => {
    const {frames, snapshot, sameRects, dragTo} = boundary(page);
    await page.goto(storyUrl('tests-gridstack--bounded-subtrees'));
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
});

test('live scale continuation matches legacy geometry', async ({page, evidence}) => {
    const {frames, snapshot} = boundary(page);
    await page.setViewportSize({width: 1800, height: 1200});
    await page.goto(storyUrl('tests-gridstack--report-canvas'));
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
    await page.goto(storyUrl('tests-gridstack--legacy-scale-continuation'));
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

test('native StrictMode unmount disposes DD and grid', async ({page, evidence}) => {
    const {oldRoot, oldHost, ...snapshots} = await strictLifecycle(page);
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

    evidence.push({
        check: 'native unmount disposes DD and grid after shared StrictMode lifecycle',
        ...snapshots,
    });
});
