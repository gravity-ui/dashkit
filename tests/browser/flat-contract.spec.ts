import assert from 'node:assert/strict';

import {expect} from '@playwright/test';

import type {Config} from '../../src/shared';

import {checked, storyUrl, test} from './fixtures';
// Critical: yes. Mounted renderers must save the same native gesture and restore it silently.
for (const engine of ['legacy']) {
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
                '[data-qa="dashkit-grid-item"]:has([data-widget-id="b"]) .react-resizable-handle-se',
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
for (const engine of ['legacy']) {
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
