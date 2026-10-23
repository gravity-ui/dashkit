import assert from 'node:assert/strict';

import type {Config} from '../../src/shared';

import {checked, storyUrl, test} from './fixtures';
import type {NativeElement} from './types';
// Critical: yes. Native edits must preserve saved geometry and a usable editor.
test('nested physical bounds and continued gestures', async ({page, evidence}) => {
    const frames = () =>
        page.evaluate(
            () =>
                new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                ),
        );
    const state = () =>
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
                    }),
                ),
            };
        });
    const held = async (x: number, y: number, dx: number, dy: number) => {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + Math.sign(dx) * 5, y + Math.sign(dy) * 5);
        await page.mouse.move(x + dx, y + dy, {steps: 16});
        await frames();
    };
    await page.goto(storyUrl('nested-containers'));
    await page.locator('[data-widget-id="b"]').waitFor();
    const item = await page.locator('[data-widget-id="b"]').boundingBox();
    const target = await page.locator('[data-dashkit-id="panel"] .grid-stack').boundingBox();
    await held(
        checked(item).x + checked(item).width / 2,
        checked(item).y + checked(item).height / 2,
        checked(target).x + 110 - checked(item).x - checked(item).width / 2,
        checked(target).y + 80 - checked(item).y - checked(item).height / 2,
    );
    await page.mouse.up();
    await frames();
    const before = await state();
    assert.equal(checked(before.config.layout.find((x) => x.i === 'b')).containerId, 'panel');
    assert.equal(checked(before.config.containers)[0].grid.maxRows, undefined);
    const handle = await page.locator('[data-dashkit-id="b"] .ui-resizable-se').boundingBox();
    const point = {
        x: checked(handle).x + checked(handle).width / 2,
        y: checked(handle).y + checked(handle).height / 2,
    };
    assert(
        checked(
            await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.className, point),
        ).includes('ui-resizable-se'),
    );
    await held(point.x, point.y, 20, 300);
    const pending = await page.locator('[data-dashkit-id="b"]').evaluate((el) => {
        function required<T>(value: T | null | undefined): T {
            if (value === null || value === undefined) {
                throw new Error('Missing native fixture value');
            }
            return value;
        }
        return {
            node: Object.fromEntries(
                (['x', 'y', 'w', 'h'] as const).map((k) => [
                    k,
                    (el as NativeElement).gridstackNode[k],
                ]),
            ),
            maxRow: (el as NativeElement).gridstackNode.grid.engine.maxRow,
            nativeMaxRow: (el as NativeElement).gridstackNode.grid.opts.maxRow,
            contentHeight: required(el.parentElement).clientHeight,
        };
    });
    assert(pending.node.y * 24 + pending.node.h * 24 - 6 <= 224 + 1e-7, JSON.stringify(pending));
    assert.equal(pending.maxRow, (224 + 6) / 24);
    assert.equal(pending.nativeMaxRow, pending.maxRow);
    await page.mouse.up();
    await frames();
    const after = await state();
    assert.equal(after.events, 'Events: 2');
    assert.equal(checked(after.config.containers)[0].grid.maxRows, undefined);
    assert.deepEqual(after.widgets, before.widgets);
    const saved = after.config.layout.find((x) => x.i === 'b');
    assert(checked(saved).y * 24 + checked(saved).h * 24 - 6 <= 224 + 1e-7);
    const nextHandle = await page.locator('[data-dashkit-id="b"] .ui-resizable-se').boundingBox();
    await held(
        checked(nextHandle).x + checked(nextHandle).width / 2,
        checked(nextHandle).y + checked(nextHandle).height / 2,
        -24,
        -48,
    );
    await page.mouse.up();
    await frames();
    const next = await state();
    assert.equal(next.events, 'Events: 3');
    assert(checked(next.config.layout.find((x) => x.i === 'b')).h < checked(saved).h);
    await page.getByRole('button', {name: 'Restore', exact: true}).click();
    await frames();
    assert.deepEqual((await state()).config, after.config);
    assert.equal((await state()).events, next.events);
    evidence.push({
        check: 'nested native SE overflow respects physical padding/gap bound before commit, preserves identity/descriptor and next resize/undo',
        before,
        pending,
        after,
        next,
    });
    const openBounds = async () => {
        await page.goto(storyUrl('nested-bounds'));
        await page.locator('[data-widget-id="b"]').waitFor();
    };
    const boundState = () =>
        page.locator('[data-dashkit-id="b"]').evaluate((el) => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            const node = (el as NativeElement).gridstackNode;
            const content = required(el.parentElement).getBoundingClientRect();
            const widget = required(
                el.querySelector<NativeElement>('[data-widget-id]'),
            ).getBoundingClientRect();
            return {
                node: Object.fromEntries((['x', 'y', 'w', 'h'] as const).map((k) => [k, node[k]])),
                maxRow: node.grid.engine.maxRow,
                nativeMaxRow: node.grid.opts.maxRow,
                content: content.toJSON(),
                widget: widget.toJSON(),
            };
        });
    const contained = (current: Awaited<ReturnType<typeof boundState>>) => {
        assert(current.node.y >= 0 && current.node.x >= 0);
        assert(current.node.y + current.node.h <= current.maxRow + 1e-7);
        assert(current.node.x + current.node.w <= 12 + 1e-7);
        for (const side of ['left', 'top']) {
            assert(
                current.widget[side] >= current.content[side] - 1,
                `${side}: ${JSON.stringify(current)}`,
            );
        }
        for (const side of ['right', 'bottom']) {
            assert(
                current.widget[side] <= current.content[side] + 1,
                `${side}: ${JSON.stringify(current)}`,
            );
        }
    };
    for (const direction of ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']) {
        await openBounds();
        const start = await state();
        const edge = await page
            .locator(`[data-dashkit-id="b"] .ui-resizable-${direction}`)
            .boundingBox();
        const origin = await page.evaluate(
            ({bounds, handleDirection}) => {
                function required<T>(value: T | null | undefined): T {
                    if (value === null || value === undefined) {
                        throw new Error('Missing native fixture value');
                    }
                    return value;
                }
                for (const yf of [0.5, 0.9, 0.1]) {
                    for (const xf of [0.5, 0.9, 0.1]) {
                        const candidate = {
                            x: required(bounds).x + required(bounds).width * xf,
                            y: required(bounds).y + required(bounds).height * yf,
                        };
                        if (
                            document
                                .elementFromPoint(candidate.x, candidate.y)
                                ?.classList.contains(`ui-resizable-${handleDirection}`)
                        ) {
                            return candidate;
                        }
                    }
                }
                return null;
            },
            {bounds: edge, handleDirection: direction},
        );
        assert(origin, `no native hit point for ${direction}: ${JSON.stringify(edge)}`);
        let dx = 0;
        let dy = 0;
        if (direction.includes('w')) {
            dx = -Math.min(400, origin.x - 3);
        } else if (direction.includes('e')) {
            dx = 400;
        }
        if (direction.includes('n')) {
            dy = -Math.min(400, origin.y - 3);
        } else if (direction.includes('s')) {
            dy = 400;
        }
        await held(origin.x, origin.y, dx, dy);
        const pendingEdge = await boundState();
        contained(pendingEdge);
        await page.mouse.up();
        await frames();
        const end = await state();
        assert.equal(end.events, 'Events: 1', JSON.stringify({direction, pendingEdge, start, end}));
        assert.deepEqual(end.widgets, start.widgets);
        contained(await boundState());
        await page.getByRole('button', {name: 'Restore', exact: true}).click();
        await frames();
        assert.deepEqual((await state()).config, start.config);
        assert.equal((await state()).events, end.events);
        evidence.push({
            check: `native nested ${direction} handle stops at physical content bounds and undo restores exact saved input without echo`,
            pendingEdge,
        });
    }
    for (const maxRows of [6, 100]) {
        await openBounds();
        await page.getByRole('button', {name: `Cap ${maxRows}`, exact: true}).click();
        const edge = await page.locator('[data-dashkit-id="b"] .ui-resizable-se').boundingBox();
        await held(
            checked(edge).x + checked(edge).width / 2,
            checked(edge).y + checked(edge).height / 2,
            20,
            400,
        );
        const pendingCap = await boundState();
        assert.equal(pendingCap.maxRow, Math.min(maxRows, 230 / 24));
        assert.equal(pendingCap.nativeMaxRow, pendingCap.maxRow);
        contained(pendingCap);
        await page.mouse.up();
        await frames();
        assert.equal(checked((await state()).config.containers)[0].grid.maxRows, maxRows);
        assert.equal((await state()).events, 'Events: 1');
        evidence.push({
            check: `native explicit maxRows${maxRows} intersects physical height without rewriting descriptor`,
            pendingCap,
        });
    }
    await openBounds();
    await page.getByRole('button', {name: 'Fractional child', exact: true}).click();
    const fractional = await state();
    const fractionNode = await boundState();
    assert.deepEqual(fractionNode.node, {x: 0.25, y: 1.25, w: 3.5, h: 8});
    contained(fractionNode);
    await page.getByRole('button', {name: 'Toggle hidden', exact: true}).click();
    await frames();
    await page.getByRole('button', {name: 'Toggle hidden', exact: true}).click();
    await frames();
    assert.deepEqual(await state(), fractional);
    assert.deepEqual((await boundState()).node, fractionNode.node);
    const parentHandle = await page
        .locator('[data-dashkit-id="panel"] > .ui-resizable-se')
        .boundingBox();
    await held(
        checked(parentHandle).x + checked(parentHandle).width / 2,
        checked(parentHandle).y + checked(parentHandle).height / 2,
        20,
        48,
    );
    await page.mouse.up();
    await frames();
    const expanded = await boundState();
    assert(expanded.maxRow > fractionNode.maxRow);
    assert.deepEqual(expanded.node, fractionNode.node);
    assert.equal((await state()).events, 'Events: 1');
    await page.getByRole('button', {name: 'Restore', exact: true}).click();
    await frames();
    assert.deepEqual(await state(), {...fractional, events: 'Events: 1'});
    assert.equal((await boundState()).maxRow, fractionNode.maxRow);
    evidence.push({
        check: 'fractional valid nested input survives hidden/reveal, native parent resize and controlled undo without echo; admission budget refreshes',
        fractionNode,
        expanded,
    });
    await openBounds();
    const dragPoint = () =>
        page.locator('[data-widget-id="b"]').evaluate((el) => {
            const rect = el.getBoundingClientRect();
            for (let y = rect.top + 3; y < rect.bottom - 3; y += 4) {
                for (let x = rect.left + 3; x < rect.right - 3; x += 4) {
                    const hit = document.elementFromPoint(x, y);
                    if (
                        hit?.closest('[data-dashkit-id="b"]') &&
                        !hit.closest(
                            'button,input,textarea,select,.ui-resizable-handle,.dashkit_draggable_cancel',
                        )
                    ) {
                        return {x, y, hit: hit.className};
                    }
                }
            }
            return null;
        });
    const beforeChild = await state();
    const pointBefore = await dragPoint();
    assert(pointBefore, 'child has no draggable content hit');
    await held(pointBefore.x, pointBefore.y, 21, 24);
    await page.mouse.up();
    await frames();
    const movedChild = await state();
    assert.equal(movedChild.config.layout[0].x, beforeChild.config.layout[0].x + 1);
    assert.equal(movedChild.config.layout[0].y, beforeChild.config.layout[0].y + 1);
    assert.equal(movedChild.events, 'Events: 1');
    const cancelPoint = await dragPoint();
    assert(cancelPoint);
    // Move this child out into the root grid, then cancel the actual native reparent.
    await held(cancelPoint.x, cancelPoint.y, 350, 40);
    assert.equal(await page.locator('.grid-stack-placeholder').count(), 1);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await frames();
    const cancelledChild = await state();
    assert.deepEqual(cancelledChild, movedChild);
    const pointAfter = await dragPoint();
    assert(pointAfter, 'restored child lost its draggable content');
    await held(pointAfter.x, pointAfter.y, 21, 24);
    await page.mouse.up();
    await frames();
    const nextChild = await state();
    assert.equal(nextChild.config.layout[0].x, movedChild.config.layout[0].x + 1);
    assert.equal(nextChild.config.layout[0].y, movedChild.config.layout[0].y + 1);
    assert.equal(nextChild.events, 'Events: 2');
    assert.deepEqual(nextChild.widgets, movedChild.widgets);
    await page.getByRole('button', {name: 'Restore', exact: true}).click();
    await frames();
    assert.deepEqual((await state()).config, movedChild.config);
    assert.equal((await state()).events, 'Events: 2');
    evidence.push({
        check: 'supported child drag works before and after native reparent/Escape, keeps instance and exact config, then one next transaction/undo',
        beforeChild,
        movedChild,
        cancelledChild,
        nextChild,
        pointBefore,
        pointAfter,
    });
    for (const height of [6, 18]) {
        await openBounds();
        await page.getByRole('button', {name: `Empty content ${height}`, exact: true}).click();
        await frames();
        const empty = await state();
        await page
            .getByRole('button', {name: '+ Widget', exact: true})
            .dragTo(page.locator('[data-dashkit-id="panel"] .grid-stack'), {
                targetPosition: {x: 70, y: height / 2},
            });
        await frames();
        const dropped = await state();
        if (height === 6) {
            assert.deepEqual(dropped, empty);
            assert.equal(await page.locator('[data-qa="drop-count"]').textContent(), '0');
        } else {
            assert.equal(dropped.config.items.length, 1);
            assert.equal(dropped.config.layout[0].containerId, 'panel');
            assert.equal(dropped.config.layout[0].h, 1);
            assert.equal(dropped.config.layout[0].y, 0);
            assert.equal(await page.locator('[data-qa="drop-count"]').textContent(), '1');
        }
        assert.equal(await page.locator('[data-dashkit-id="__dropping-elem__"]').count(), 0);
        evidence.push({
            check: `native palette content height${height} has ${height === 6 ? 'zero full rows and rejects impossible minimum' : 'one row and admits one bounded child'}`,
            dropped,
        });
    }
});
