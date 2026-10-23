import assert from 'node:assert/strict';

import type {Config} from '../../src/shared';

import {checked, storyUrl, test} from './fixtures';
// Critical: yes. Both mounted renderers must save the same native gesture and restore it silently.
for (const engine of ['legacy', 'gridstack']) {
    test(`[${engine}] common flat native drag, resize, restore and identity`, async ({
        page,
        evidence,
    }) => {
        await page.goto(storyUrl('flat-contract', {legacy: engine === 'legacy'}));
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
        await page.waitForFunction(() => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            return (
                required(document.querySelector('[data-qa="event-count"]')).textContent ===
                'Events: 1'
            );
        });
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
        await page.waitForFunction(() => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            return (
                required(document.querySelector('[data-qa="event-count"]')).textContent ===
                'Events: 2'
            );
        });
        const resized = await saved();
        assert.deepEqual(resized.layout, [
            original.layout[0],
            {...original.layout[1], w: 205, h: 145},
        ]);
        assert.deepEqual(await identities(), originalIdentities);
        evidence.push({
            check: 'same native drag, controlled restore and corner resize preserve saved layout and widget identity',
            engine,
            original,
            moved,
            resized,
        });
    });
}
