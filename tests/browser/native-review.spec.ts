import assert from 'node:assert/strict';

import {expect} from '@playwright/test';

import type {Config} from '../../src/shared';

import {checked, test} from './fixtures';
import type {NativeElement} from './types';

// Critical: yes. Cross-grid editing must preserve portal hosts, coordinates, configured constraints and admission policy.
for (const mode of ['bounded', 'nested', 'nowrap', 'fractional', 'occupied', 'subtree']) {
    test(`native review ${mode} preserves transactional editing`, async ({page, evidence}) => {
        await page.setViewportSize({width: 1600, height: 900});
        await page.goto(`/iframe.html?id=tests-native-review--${mode}&viewMode=story`);
        const widget = page.locator('[data-review-widget="a"]');
        await widget.waitFor();
        const saved = async () =>
            JSON.parse(
                checked(await page.locator('[data-qa="review-config"]').textContent()),
            ) as Config;
        const original = await saved();
        const target = page.locator(
            mode === 'nested' || mode === 'occupied' || mode === 'subtree'
                ? '[data-dashkit-id="target"] .grid-stack'
                : '[data-review-zone="right"] .grid-stack',
        );
        const right = checked(await target.boundingBox());
        const host = page.locator(`[data-dashkit-id="${mode === 'subtree' ? 'small' : 'a'}"]`);
        const origin = checked(await host.boundingBox());
        let previewConstraints: unknown;
        const drag = async (outside = false) => {
            const current = checked(await host.boundingBox());
            const x = current.x + current.width / 2,
                y = current.y + current.height - 12;
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + 5, y + 5);
            await page.mouse.move(
                right.x + (mode === 'bounded' || mode === 'nested' ? 500 : 100),
                right.y +
                    (mode === 'bounded' || mode === 'nested'
                        ? 108
                        : mode === 'occupied'
                          ? 140
                          : 100),
                {steps: 16},
            );
            if (outside) {
                await page.mouse.move(right.x + right.width + 150, right.y + 108, {steps: 8});
            }
            if (mode === 'fractional') {
                previewConstraints = await host.evaluate((el) => {
                    const n = (el as NativeElement).gridstackNode;
                    return {w: n.w, h: n.h, minW: n.minW, maxW: n.maxW, minH: n.minH, maxH: n.maxH};
                });
            }
            await page.mouse.up();
        };
        await drag();
        if (mode === 'nowrap' || mode === 'subtree') {
            assert.equal(checked((await saved()).layout.find(({i}) => i === 'a')).parent, 'left');
            await expect(widget).toHaveCount(1);
            if (mode === 'subtree') {
                await page.getByRole('button', {name: 'Read admission', exact: true}).click();
                const calls = JSON.parse(
                    checked(await page.locator('[data-qa="review-admission"]').textContent()),
                ) as Array<{i: string; parent?: string; containerId?: string; type: string}>;
                assert(
                    calls.some(
                        (item) =>
                            item.i === 'b' &&
                            item.parent === 'right' &&
                            item.containerId === 'twig' &&
                            item.type === 'native-review-widget',
                    ),
                );
                await page.getByRole('button', {name: 'Allow subtree', exact: true}).click();
                await drag();
                await expect(page.locator('[data-qa="review-events"]')).not.toHaveText('0');
                assert((await saved()).layout.every((item) => item.parent === 'right'));
            } else {
                // A rejected target must leave the React portal host and following source gesture usable.
                const current = checked(await host.boundingBox());
                await page.mouse.move(current.x + 30, current.y + 30);
                await page.mouse.down();
                await page.mouse.move(current.x + 35, current.y + 35);
                await page.mouse.move(current.x + 80, current.y + 70, {steps: 8});
                await page.mouse.up();
                await expect(page.locator('[data-qa="review-events"]')).not.toHaveText('0');
                await expect(widget).toHaveCount(1);
            }
        } else {
            await expect(page.locator('[data-qa="review-events"]')).toHaveText('1');
            const entry = checked((await saved()).layout.find(({i}) => i === 'a'));
            assert.equal(entry.parent, 'right');
            if (mode === 'bounded' || mode === 'nested') {
                assert.equal(entry.x, 9);
                assert.equal(entry.y, 2);
                assert.equal(entry.containerId, mode === 'nested' ? 'target' : undefined);
                if (mode === 'nested') {
                    assert.equal(
                        await page
                            .locator('[data-dashkit-id="target"] > .grid-stack-item-content')
                            .evaluate((el) => getComputedStyle(el).overflow),
                        'visible',
                    );
                    await expect(
                        page.locator('[data-dashkit-id="a"] > .ui-resizable-se'),
                    ).toBeVisible();
                }
                // Return to the left, then traverse right and release beyond every grid.
                await page.reload();
                await widget.waitFor();
                await drag(true);
                await expect(page.locator('[data-qa="review-events"]')).toHaveText('1');
                const outside = checked((await saved()).layout.find(({i}) => i === 'a'));
                assert.equal(outside.parent, 'right');
                assert.equal(outside.containerId, mode === 'nested' ? 'target' : undefined);
                assert.equal(outside.x, 10);
                assert.equal(outside.y, 2);
            } else if (mode === 'fractional') {
                assert.equal(entry.w, 4);
                assert.equal(entry.h, 4);
                assert.deepEqual(previewConstraints, {
                    w: 4,
                    h: 4,
                    minW: 4,
                    maxW: 5,
                    minH: 4,
                    maxH: 5,
                });
            } else {
                assert.equal(entry.containerId, 'target');
                const neighbour = checked((await saved()).layout.find(({i}) => i === 'b'));
                assert(entry.y + entry.h <= neighbour.y || neighbour.y + neighbour.h <= entry.y);
                assert(entry.y + entry.h <= 8 && neighbour.y + neighbour.h <= 8);
            }
        }
        evidence.push({mode, original, origin, final: await saved()});
    });
}

// Critical: no. Avoid duplicate forced layout while preserving live transformed pointer geometry.
test('implicit live scale refresh uses at most two transform probes per drag motion', async ({
    page,
    evidence,
}) => {
    await page.setViewportSize({width: 1600, height: 900});
    await page.goto('/iframe.html?id=tests-native-review--bounded&viewMode=story');
    const host = page.locator('[data-dashkit-id="a"]');
    await host.waitFor();
    const original = checked(await host.boundingBox());
    const x = original.x + 50,
        y = original.y + 60;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 5, y + 5);
    await page.mouse.move(x + 50, y);
    await page.evaluate(() => {
        document.body.dataset.transformProbes = '0';
        const observer = new MutationObserver((entries) => {
            const count = entries
                .flatMap((entry) => [...entry.addedNodes])
                .filter(
                    (node) =>
                        node instanceof HTMLElement &&
                        node.style.position === 'fixed' &&
                        node.style.opacity === '0' &&
                        node.style.width === '1px',
                ).length;
            document.body.dataset.transformProbes = String(
                Number(document.body.dataset.transformProbes) + count,
            );
        });
        observer.observe(document.body, {childList: true, subtree: true});
        document.addEventListener('stop-transform-probe', () => observer.disconnect(), {
            once: true,
        });
    });
    await page.mouse.move(x + 100, y);
    const probes = await page.evaluate(() => {
        document.dispatchEvent(new Event('stop-transform-probe'));
        return Number(document.body.dataset.transformProbes);
    });
    assert(probes > 0 && probes <= 2, `transform probes for one drag motion: ${probes}`);
    await page.locator('[data-dashkit-engine]').evaluate((el) => {
        const parent = el.parentElement;
        if (!parent) {
            throw new Error('Missing canvas');
        }
        parent.style.transform = 'scale(2)';
        parent.style.transformOrigin = 'top left';
    });
    await page.mouse.move(x + 120, y + 110);
    const position = () =>
        host.evaluate((el) => {
            const node = (el as NativeElement).gridstackNode;
            return {x: node.x, y: node.y};
        });
    const before = await position();
    await page.mouse.move(x + 220, y + 150);
    const after = await position();
    assert.equal(after.x - before.x, 1);
    assert.equal(after.y - before.y, 1, JSON.stringify({before, after}));
    await page.mouse.up();
    await expect(page.locator('[data-qa="review-events"]')).toHaveText('1');
    evidence.push({probes, before, after});
});

// Critical: yes. A target that loses its placeholder after admission must never delete a React portal host.
test('failed native preview restores the source and keeps the following gesture usable', async ({
    page,
    evidence,
}) => {
    await page.setViewportSize({width: 1600, height: 900});
    await page.goto('/iframe.html?id=tests-native-review--bounded&viewMode=story');
    const host = page.locator('[data-dashkit-id="a"]');
    await host.waitFor();
    const original = checked(await host.boundingBox());
    const target = checked(
        await page.locator('[data-review-zone="right"] .grid-stack').boundingBox(),
    );
    await page.mouse.move(original.x + 50, original.y + 60);
    await page.mouse.down();
    await page.mouse.move(original.x + 55, original.y + 65);
    await page.mouse.move(target.x + 500, target.y + 108, {steps: 16});
    await host.evaluate((el) => {
        const node = (el as NativeElement).gridstackNode;
        node.grid.engine.removeNode(node);
    });
    await page.mouse.up();
    await expect(page.locator('[data-review-widget="a"]')).toHaveCount(1);
    await expect(page.locator('[data-qa="review-events"]')).toHaveText('0');
    const restored = checked(await host.boundingBox());
    assert.deepEqual(restored, original);
    await page.mouse.move(restored.x + 30, restored.y + 30);
    await page.mouse.down();
    await page.mouse.move(restored.x + 35, restored.y + 35);
    await page.mouse.move(restored.x + 80, restored.y + 70, {steps: 8});
    await page.mouse.up();
    await expect(page.locator('[data-qa="review-events"]')).toHaveText('1');
    const config = JSON.parse(
        checked(await page.locator('[data-qa="review-config"]').textContent()),
    ) as Config;
    assert.deepEqual(
        config.layout.find(({i}) => i === 'a'),
        {i: 'a', parent: 'left', x: 1, y: 2, w: 2, h: 4},
    );
    evidence.push({original, restored, final: config});
});
