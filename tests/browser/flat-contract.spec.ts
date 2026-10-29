import assert from 'node:assert/strict';

import {type Locator, type Page, expect} from '@playwright/test';

import type {GridItemHTMLElement} from '../../src/components/GridStack/runtime';
import type {Config} from '../../src/shared';

import {checked, storyUrl, test} from './fixtures';

// Critical: yes. A controlled zone transfer must leave the next edit with the destination engine.
test('[gridstack] active controlled zone transfer preserves native ownership and the next edit', async ({
    page,
    evidence,
}) => {
    await page.goto(storyUrl('active-zone-transfer'));
    const widget = page.locator('[data-widget-id="a"]');
    await widget.waitFor();
    const saved = async () =>
        JSON.parse(checked(await page.locator('[data-qa="saved-config"]').textContent())) as Config;
    const initial = await saved();
    const identity = await widget.getAttribute('data-widget-instance');
    const before = checked(await widget.boundingBox());
    await page.mouse.move(before.x + 30, before.y + 30);
    await page.mouse.down();
    await page.mouse.move(before.x + 80, before.y + 30);
    await expect.poll(async () => checked(await widget.boundingBox()).x).toBe(before.x + 50);
    await page
        .getByRole('button', {name: 'Transfer to destination', exact: true})
        .dispatchEvent('click');
    await page.mouse.up();
    const transferred = {
        ...initial,
        layout: initial.layout.map((entry) => ({...entry, parent: 'destination'})),
    };
    assert.deepEqual(await saved(), transferred);
    await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 0');
    const host = page.locator('[data-dashkit-id="a"]');
    const ownership = await host.evaluate((el: GridItemHTMLElement) => ({
        ownsParent: el.gridstackNode?.grid?.el === el.parentElement,
        registered: el.gridstackNode?.grid?.engine.nodes.includes(el.gridstackNode),
    }));
    // A single native delta reaches b directly, without an intermediate accepted position.
    const moved = checked(await widget.boundingBox());
    await page.mouse.move(moved.x + 30, moved.y + 30);
    await page.mouse.down();
    await page.mouse.move(moved.x + 230, moved.y + 30);
    await page.mouse.up();
    evidence.push({initial, transferred, ownership, afterCollision: await saved()});
    assert.deepEqual(ownership, {ownsParent: true, registered: true});
    assert.deepEqual(await saved(), transferred);
    assert.deepEqual(checked(await widget.boundingBox()), moved);
    await drag(page, widget, moved.x + 30, moved.y + 30, 50, 40, 'x');
    await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
    assert.deepEqual((await saved()).layout, [
        {...transferred.layout[0], x: 1, y: 2},
        transferred.layout[1],
    ]);
    assert.equal(await widget.getAttribute('data-widget-instance'), identity);
});

async function drag(
    page: Page,
    widget: Locator,
    x: number,
    y: number,
    dx: number,
    dy: number,
    dimension: 'x' | 'width',
) {
    const before = checked(await widget.boundingBox());
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 5, y + 5);
    // Commit the first position or size before sending the next native delta.
    await expect
        .poll(async () => checked(await widget.boundingBox())[dimension])
        .toBe(before[dimension] + 5);
    await page.mouse.move(x + dx, y + dy, {steps: 1});
    await page.mouse.up();
}
// Critical: yes. Mounted renderers must save the same native gesture and restore it silently.
for (const engine of ['legacy', 'gridstack']) {
    test(`[${engine}] common flat native drag, resize, restore and identity`, async ({
        page,
        evidence,
    }) => {
        await page.goto(storyUrl('flat-contract', {engine}));
        await page.locator('[data-widget-id="b"]').waitFor();
        assert.equal(
            await page.locator('[data-dashkit-engine]').getAttribute('data-dashkit-engine'),
            engine,
        );
        const saved = async () =>
            JSON.parse(
                checked(await page.locator('[data-qa="saved-config"]').textContent()),
            ) as Config;
        const identities = () =>
            page
                .locator('[data-widget-id]')
                .evaluateAll((elements) =>
                    elements.map((el) => [
                        el.getAttribute('data-widget-id'),
                        el.getAttribute('data-widget-instance'),
                    ]),
                );
        const original = await saved();
        const originalIdentities = await identities();
        const widget = page.locator('[data-widget-id="a"]');
        const before = checked(await widget.boundingBox());
        await drag(page, widget, before.x + 30, before.y + 60, 45, 35, 'x');
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
        const moved = await saved();
        assert.deepEqual(moved.layout, [{...original.layout[0], x: 85, y: 75}, original.layout[1]]);
        assert.deepEqual(await identities(), originalIdentities);
        await page.getByRole('button', {name: 'Restore', exact: true}).click();
        assert.deepEqual(await saved(), original);
        assert.equal(await page.locator('[data-qa="event-count"]').textContent(), 'Events: 1');
        const restored = checked(await widget.boundingBox());
        assert(Math.abs(restored.x - before.x) <= 1);
        assert(Math.abs(restored.y - before.y) <= 1);
        const corner = await page
            .locator(
                '[data-qa="dashkit-grid-item"]:has([data-widget-id="b"]) .react-resizable-handle-se, [data-dashkit-id="b"] > .ui-resizable-se',
            )
            .boundingBox();
        assert(corner);
        await drag(
            page,
            page.locator('[data-widget-id="b"]'),
            corner.x + corner.width / 2,
            corner.y + corner.height / 2,
            25,
            25,
            'width',
        );
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 2');
        const resized = await saved();
        assert.deepEqual(resized.layout, [
            original.layout[0],
            {...original.layout[1], w: 205, h: 145},
        ]);
        assert.deepEqual(await identities(), originalIdentities);
        // Critical: yes. A second move masks stale gesture state left behind by resize.
        // The first single-move drag must save its full delta, exactly once.
        const resizedWidget = page.locator('[data-widget-id="b"]');
        const resizedBox = checked(await resizedWidget.boundingBox());
        assert.equal(resizedBox.width, 205);
        assert.equal(resizedBox.height, 145);
        await page.mouse.move(resizedBox.x + 30, resizedBox.y + 60);
        await page.mouse.down();
        await page.mouse.move(resizedBox.x + 65, resizedBox.y + 80, {steps: 1});
        await page.mouse.up();
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 3');
        const afterResizeDrag = await saved();
        assert.deepEqual(afterResizeDrag.layout, [
            original.layout[0],
            {...original.layout[1], x: 155, y: 100, w: 205, h: 145},
        ]);
        assert.deepEqual(await identities(), originalIdentities);
        evidence.push({
            check: 'same native drag, controlled restore and corner resize preserve saved layout and widget identity',
            engine,
            original,
            moved,
            resized,
            afterResizeDrag,
        });
    });
}

// Critical: no. Exact visible geometry catches clipped or unreset autoheight that saved-layout checks miss.
for (const engine of ['legacy', 'gridstack']) {
    test(`[${engine}] common mounted autoheight grows, survives a move and resets to saved height`, async ({
        page,
        evidence,
    }) => {
        await page.goto(storyUrl('flat-contract', {engine}));
        const widget = page.locator('[data-widget-id="b"]');
        await widget.waitFor();
        await expect(page.locator('[data-dashkit-engine]')).toHaveAttribute(
            'data-dashkit-engine',
            engine,
        );
        const saved = async () =>
            JSON.parse(
                checked(await page.locator('[data-qa="saved-config"]').textContent()),
            ) as Config;
        const initial = await saved();
        const before = checked(await widget.boundingBox());
        const identity = await widget.getAttribute('data-widget-instance');
        assert.equal(before.height, 120);
        await page.getByRole('button', {name: 'Toggle edit', exact: true}).click();
        await page.locator('[data-qa="grow-b"]').click();
        await expect.poll(async () => checked(await widget.boundingBox()).height).toBe(160);
        assert.deepEqual(await saved(), initial);
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 0');
        await page.getByRole('button', {name: 'Toggle edit', exact: true}).click();
        const grown = checked(await widget.boundingBox());
        await drag(page, widget, grown.x + 30, grown.y + 70, 35, 20, 'x');
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
        const moved = await saved();
        assert.deepEqual(moved.layout, [initial.layout[0], {...initial.layout[1], x: 155, y: 100}]);
        const movedBox = checked(await widget.boundingBox());
        assert.equal(movedBox.height, 160);
        assert.equal(movedBox.x - before.x, 35);
        assert.equal(movedBox.y - before.y, 20);
        await page.getByRole('button', {name: 'Toggle edit', exact: true}).click();
        await page.locator('[data-qa="reset-b"]').click();
        await expect.poll(async () => checked(await widget.boundingBox()).height).toBe(120);
        assert.deepEqual(await saved(), moved);
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
        assert.equal(await widget.getAttribute('data-widget-instance'), identity);
        evidence.push({
            check: 'visual height grows 120→160, move saves h=120, reset restores 120',
            engine,
            initial,
            moved,
        });
    });
}

// Critical: yes. A bounded flat edit must never persist a widget outside its fixed canvas.
for (const engine of ['legacy', 'gridstack']) {
    test(`[${engine}] common bounded drag without maxRows`, async ({page, evidence}) => {
        await page.goto(storyUrl('bounded-contract', {engine}));
        const widget = page.locator('[data-widget-id="a"]');
        await widget.waitFor();
        await expect(page.locator('[data-dashkit-engine]')).toHaveAttribute(
            'data-dashkit-engine',
            engine,
        );
        const saved = async () =>
            JSON.parse(
                checked(await page.locator('[data-qa="saved-config"]').textContent()),
            ) as Config;
        const initial = await saved();
        const before = checked(await widget.boundingBox());
        const canvas = checked(await page.locator('[data-qa="canvas"]').boundingBox());
        const identity = await widget.getAttribute('data-widget-instance');
        const boundedDrag = async (dx: number, dy: number) => {
            const box = checked(await widget.boundingBox());
            await page.mouse.move(box.x + 30, box.y + 30);
            await page.mouse.down();
            await page.mouse.move(box.x + 35, box.y + 35);
            await page.mouse.move(box.x + 30 + dx, box.y + 30 + dy, {steps: 1});
            const moving = checked(await widget.boundingBox());
            evidence.push({engine, check: 'live bounded geometry', moving, canvas});
            await page.mouse.up();
            return moving;
        };
        const live = await boundedDrag(0, 600);
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
        const moved = await saved();
        const after = checked(await widget.boundingBox());
        evidence.push({engine, initial, before, moved, after, canvas});
        assert.deepEqual(moved.layout, [{i: 'a', x: 0, y: 18, w: 2, h: 2}]);
        assert(live.y + live.height <= canvas.y + canvas.height + 1);
        assert.equal(after.y - before.y, 360);
        assert.equal(after.y + after.height, canvas.y + canvas.height);
        await page.getByRole('button', {name: 'Restore', exact: true}).click();
        assert.deepEqual(await saved(), initial);
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
        assert.equal(checked(await widget.boundingBox()).y, before.y);
        await boundedDrag(50, 40);
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 2');
        assert.deepEqual((await saved()).layout, [{i: 'a', x: 1, y: 2, w: 2, h: 2}]);
        const resize = async (dx: number, dy: number) => {
            const handle = checked(
                await page
                    .locator(
                        '[data-qa="dashkit-grid-item"] .react-resizable-handle-se, [data-dashkit-id="a"] > .ui-resizable-se',
                    )
                    .boundingBox(),
            );
            const x = handle.x + handle.width / 2;
            const y = handle.y + handle.height / 2;
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + dx, y + dy, {steps: 1});
            await page.mouse.up();
        };
        await resize(250, 200);
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 3');
        assert.deepEqual((await saved()).layout, [{i: 'a', x: 1, y: 2, w: 4, h: 4}]);
        await resize(-175, -70);
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 4');
        assert.deepEqual((await saved()).layout, [{i: 'a', x: 1, y: 2, w: 1, h: 1}]);
        assert.equal(await widget.getAttribute('data-widget-instance'), identity);
    });
}

// Critical: no. Dynamic public resize controls must remain mounted on native targets.
for (const engine of ['legacy', 'gridstack']) {
    test(`[${engine}] common custom resize controls survive renderer and direction changes`, async ({
        page,
        evidence,
    }) => {
        await page.goto(storyUrl('resize-controls', {engine}));
        await expect(page.locator('[data-qa="custom-resize"]')).toHaveText(['se old', 'se old']);
        await expect(page.locator('.dashkit-grid-item__overlay')).toHaveCount(0);
        const before = await page.locator('[data-qa="saved-config"]').textContent();
        const identities = await page
            .locator('[data-widget-id]')
            .evaluateAll((elements) =>
                elements.map((el) => el.getAttribute('data-widget-instance')),
            );
        await page.getByRole('button', {name: 'Update handle renderer', exact: true}).click();
        await expect(page.locator('[data-qa="custom-resize"]')).toHaveText(['se new', 'se new']);
        await expect(page.locator('.dashkit-grid-item__overlay')).toHaveCount(2);
        assert.equal(await page.locator('[data-qa="saved-config"]').textContent(), before);
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 0');
        const southeast = checked(
            await page.locator('[data-qa="custom-resize"]').last().boundingBox(),
        );
        await page.mouse.move(
            southeast.x + southeast.width / 2,
            southeast.y + southeast.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
            southeast.x + southeast.width / 2 + 20,
            southeast.y + southeast.height / 2 + 20,
            {steps: 1},
        );
        await page.mouse.up();
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
        const initial = JSON.parse(checked(before)) as Config;
        assert.deepEqual(
            (
                JSON.parse(
                    checked(await page.locator('[data-qa="saved-config"]').textContent()),
                ) as Config
            ).layout,
            [initial.layout[0], {...initial.layout[1], w: 200, h: 140}],
        );
        assert.deepEqual(
            await page
                .locator('[data-widget-id]')
                .evaluateAll((elements) =>
                    elements.map((el) => el.getAttribute('data-widget-instance')),
                ),
            identities,
        );
        await page.getByRole('button', {name: 'Restore', exact: true}).click();
        assert.equal(await page.locator('[data-qa="saved-config"]').textContent(), before);
        await page.getByRole('button', {name: 'Use northwest handles', exact: true}).click();
        evidence.push({
            engine,
            controls: await page.locator('[data-qa="custom-resize"]').allTextContents(),
            nativeTargets: await page.locator('.ui-resizable-nw').count(),
        });
        await expect(page.locator('[data-qa="custom-resize"]')).toHaveText(['nw new', 'nw new']);
        assert.equal(await page.locator('[data-qa="saved-config"]').textContent(), before);
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
        const handle = checked(
            await page.locator('[data-qa="custom-resize"]').first().boundingBox(),
        );
        const x = handle.x + handle.width / 2;
        const y = handle.y + handle.height / 2;
        const widget = page.locator('[data-widget-id]').first();
        const originalBox = checked(await widget.boundingBox());
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - 5, y - 5);
        // WebKit must apply the first resize position before the final native delta.
        await expect
            .poll(async () => checked(await widget.boundingBox()).x)
            .toBe(originalBox.x - 5);
        await page.mouse.move(x - 20, y - 20, {steps: 1});
        await expect
            .poll(async () => checked(await widget.boundingBox()).x)
            .toBe(originalBox.x - 20);
        await page.mouse.up();
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 2');
        const resized = JSON.parse(
            checked(await page.locator('[data-qa="saved-config"]').textContent()),
        ) as Config;
        assert.deepEqual(resized.layout, [
            {...initial.layout[0], x: 20, y: 20, w: 180, h: 120},
            initial.layout[1],
        ]);
        assert.deepEqual(
            await page
                .locator('[data-widget-id]')
                .evaluateAll((elements) =>
                    elements.map((el) => el.getAttribute('data-widget-instance')),
                ),
            identities,
        );
    });
}

// Critical: yes. A delayed save acknowledgment must not discard the next active edit.
// Real pointer geometry and saved output catch cancellation that revision-only checks miss.
for (const engine of ['legacy', 'gridstack']) {
    for (const acknowledgment of ['same', 'clone']) {
        test(`[${engine}] common delayed ${acknowledgment} acknowledgment preserves active drag`, async ({
            page,
            evidence,
        }) => {
            await page.goto(storyUrl('delayed-acknowledgment', {engine}));
            const widget = page.locator('[data-widget-id="a"]');
            await widget.waitFor();
            await expect(page.locator('[data-dashkit-engine]')).toHaveAttribute(
                'data-dashkit-engine',
                engine,
            );
            const original = checked(await widget.boundingBox());
            const identity = await widget.getAttribute('data-widget-instance');
            const saved = async () =>
                JSON.parse(
                    checked(await page.locator('[data-qa="saved-config"]').textContent()),
                ) as Config;
            const initial = await saved();
            const startDrag = async () => {
                const box = checked(await widget.boundingBox());
                await page.mouse.move(box.x + 25, box.y + 30);
                await page.mouse.down();
                await page.mouse.move(box.x + 30, box.y + 30);
                await page.mouse.move(box.x + 75, box.y + 30);
            };
            await startDrag();
            await page.mouse.up();
            await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
            assert.deepEqual((await saved()).layout, [{...initial.layout[0], x: 1}]);
            await expect
                .poll(async () => checked(await widget.boundingBox()).x - original.x)
                .toBe(50);
            await startDrag();
            await expect
                .poll(async () => checked(await widget.boundingBox()).x - original.x)
                .toBe(100);
            // Dispatch the host acknowledgment without releasing or moving the held pointer.
            await page
                .getByRole('button', {name: `Acknowledge ${acknowledgment}`, exact: true})
                .dispatchEvent('click');
            await expect
                .poll(async () => checked(await widget.boundingBox()).x - original.x)
                .toBe(100);
            await page.mouse.up();
            await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 2');
            assert.deepEqual((await saved()).layout, [{...initial.layout[0], x: 2}]);
            assert.equal(checked(await widget.boundingBox()).x - original.x, 100);
            assert.equal(await widget.getAttribute('data-widget-instance'), identity);
            evidence.push({engine, acknowledgment, initial, saved: await saved()});
        });
    }
}

// Critical: yes. A genuinely different external document must still cancel a native gesture.
test('[gridstack] external value clone cancels active drag without saving it', async ({page}) => {
    await page.goto(storyUrl('delayed-acknowledgment', {engine: 'gridstack'}));
    const widget = page.locator('[data-widget-id="a"]');
    await widget.waitFor();
    const original = checked(await widget.boundingBox());
    const startDrag = async () => {
        const box = checked(await widget.boundingBox());
        await page.mouse.move(box.x + 25, box.y + 30);
        await page.mouse.down();
        await page.mouse.move(box.x + 30, box.y + 30);
        await page.mouse.move(box.x + 75, box.y + 30);
    };
    await startDrag();
    await page.mouse.up();
    await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
    const saved = await page.locator('[data-qa="saved-config"]').textContent();
    await startDrag();
    await expect.poll(async () => checked(await widget.boundingBox()).x - original.x).toBe(100);
    await page.getByRole('button', {name: 'External reset', exact: true}).dispatchEvent('click');
    await expect.poll(async () => checked(await widget.boundingBox()).x).toBe(original.x);
    await page.mouse.up();
    await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
    assert.equal(await page.locator('[data-qa="saved-config"]').textContent(), saved);
    assert.equal(checked(await widget.boundingBox()).x, original.x);
});

// Critical: yes. Minimum-size widgets must retain public edit controls outside their content box.
for (const engine of ['legacy', 'gridstack']) {
    test(`[${engine}] minimum-size widget retains a usable edit control after shrinking`, async ({
        page,
        evidence,
    }) => {
        await page.goto(storyUrl('flat-contract', {engine}));
        const widget = page.locator('[data-widget-id="b"]');
        await widget.waitFor();
        const identity = await widget.getAttribute('data-widget-instance');
        const commitMotion = () =>
            page.evaluate(
                () =>
                    new Promise<void>((resolve) =>
                        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                    ),
            );
        const startDrag = async (x: number, y: number, dx: number, dy: number) => {
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + Math.sign(dx) * 5, y + Math.sign(dy) * 5);
            await commitMotion();
            for (let step = 1; step <= 8; step++) {
                await page.mouse.move(x + (dx * step) / 8, y + (dy * step) / 8);
                await commitMotion();
            }
        };
        const initial = checked(await widget.boundingBox());
        await startDrag(initial.x + initial.width / 2, initial.y + initial.height - 12, 280, 160);
        await page.mouse.up();
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
        const host = page
            .locator(
                ':is([data-dashkit-id="b"], [data-qa="dashkit-grid-item"]:has([data-widget-id="b"]))',
            )
            .first();
        const corner = checked(
            await host.locator(':is(.ui-resizable-se, .react-resizable-handle-se)').boundingBox(),
        );
        const moved = checked(await widget.boundingBox());
        await startDrag(
            corner.x + corner.width / 2,
            corner.y + corner.height / 2,
            moved.x + 5 - corner.x - corner.width / 2,
            moved.y + 5 - corner.y - corner.height / 2,
        );
        await expect
            .poll(async () => {
                const box = checked(await widget.boundingBox());
                return [box.width, box.height];
            })
            .toEqual([20, 20]);
        await page.mouse.up();
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 2');
        const saved = JSON.parse(
            checked(await page.locator('[data-qa="saved-config"]').textContent()),
        ) as Config;
        const item = checked(saved.layout.find(({i}) => i === 'b'));
        assert.equal(item.w, 20);
        assert.equal(item.h, 20);
        await host.locator('[data-qa="dashkit-overlay-control-settings"]').click({timeout: 2000});
        await expect(page.locator('[data-qa="edited-item"]')).toHaveText('b');
        assert.equal(await widget.getAttribute('data-widget-instance'), identity);
        evidence.push({
            check: 'real pointer reaches public edit callback at permitted plugin minimum',
            engine,
            saved,
        });
    });
}
