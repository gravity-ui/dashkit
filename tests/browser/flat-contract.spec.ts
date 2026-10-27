import assert from 'node:assert/strict';

import {expect} from '@playwright/test';

import type {Config} from '../../src/shared';

import {checked, storyUrl, test} from './fixtures';
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
        const drag = async (x: number, y: number, dx: number, dy: number) => {
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + 5, y + 5);
            await page.mouse.move(x + dx, y + dy, {steps: 1});
            await page.mouse.up();
        };
        await drag(before.x + 30, before.y + 60, 45, 35);
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
        await drag(corner.x + corner.width / 2, corner.y + corner.height / 2, 25, 25);
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
        await page.mouse.move(grown.x + 30, grown.y + 70);
        await page.mouse.down();
        await page.mouse.move(grown.x + 35, grown.y + 75);
        await page.mouse.move(grown.x + 65, grown.y + 90, {steps: 1});
        await page.mouse.up();
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
        const drag = async (dx: number, dy: number) => {
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
        const live = await drag(0, 600);
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
        await drag(50, 40);
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
    test(`[${engine}] common custom resize controls survive direction change`, async ({
        page,
        evidence,
    }) => {
        await page.goto(storyUrl('resize-controls', {engine}));
        await expect(page.locator('[data-qa="custom-resize"]')).toHaveText(['se', 'se']);
        const before = await page.locator('[data-qa="saved-config"]').textContent();
        const identities = await page
            .locator('[data-widget-id]')
            .evaluateAll((elements) =>
                elements.map((el) => el.getAttribute('data-widget-instance')),
            );
        await page.getByRole('button', {name: 'Use northwest handles', exact: true}).click();
        evidence.push({
            engine,
            controls: await page.locator('[data-qa="custom-resize"]').allTextContents(),
            nativeTargets: await page.locator('.ui-resizable-nw').count(),
        });
        await expect(page.locator('[data-qa="custom-resize"]')).toHaveText(['nw', 'nw']);
        assert.equal(await page.locator('[data-qa="saved-config"]').textContent(), before);
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 0');
        const handle = checked(
            await page.locator('[data-qa="custom-resize"]').first().boundingBox(),
        );
        const x = handle.x + handle.width / 2;
        const y = handle.y + handle.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - 20, y - 20, {steps: 1});
        await page.mouse.up();
        await expect(page.locator('[data-qa="event-count"]')).toHaveText('Events: 1');
        const resized = JSON.parse(
            checked(await page.locator('[data-qa="saved-config"]').textContent()),
        ) as Config;
        const initial = JSON.parse(checked(before)) as Config;
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
