import assert from 'node:assert/strict';

import {expect} from '@playwright/test';
import type {Page} from '@playwright/test';

import type {Config} from '../../src/shared';

import {checked, dropPalette, storyUrl, test} from './fixtures';
import type {NativeElement} from './types';

async function hover(page: Page) {
    const source = checked(
        await page.getByRole('button', {name: '+ Add', exact: true}).boundingBox(),
    );
    const root = page.locator('.grid-stack').first();
    const bounds = checked(await root.boundingBox());
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2, {
        steps: 3,
    });
    await page.mouse.move(bounds.x + 145, bounds.y + 5);
    await page.mouse.move(bounds.x + 145, bounds.y + 5);
    await expect(page.locator('[data-dashkit-id="__dropping-elem__"]')).toHaveCount(1);
    return {root, bounds};
}

// Critical: no. Periodic identical palette motion must not repeatedly render an unchanged plugin.
test('unchanged palette dragover keeps existing plugin render count stable', async ({
    page,
    evidence,
}) => {
    await page.goto(storyUrl('tests-gridstack--palette-document'));
    const child = page.locator('[data-palette-child="child"]');
    await child.waitFor();
    const {root, bounds} = await hover(page);
    const before = await child.getAttribute('data-palette-renders');
    for (let n = 0; n < 8; n++) {
        await root.dispatchEvent('dragover', {clientX: bounds.x + 145, clientY: bounds.y + 5});
    }
    assert.equal(await child.getAttribute('data-palette-renders'), before);
    await page.mouse.up();
    evidence.push({before, after: await child.getAttribute('data-palette-renders')});
});

// Critical: yes. A valid palette addition must remain possible before an auto-height bounded grid grows.
for (const empty of [true, false]) {
    test(`bounded auto-height palette accepts tall addition with empty=${empty}`, async ({
        page,
        evidence,
    }) => {
        await page.goto(
            storyUrl('tests-gridstack--palette-document', {bounded: true, autoHeight: true, empty}),
        );
        const source = page.getByRole('button', {name: '+ Add', exact: true});
        const root = page.locator('.grid-stack').first();
        await root.waitFor();
        const before = JSON.parse(
            checked(await page.locator('[data-qa="saved-config"]').textContent()),
        ) as Config;
        await dropPalette(page, source, root, {x: 145, y: 5});
        await expect(page.locator('[data-qa="drop-count"]')).toHaveText('1');
        const entry = JSON.parse(
            checked(await page.locator('[data-qa="drop-layout"]').textContent()),
        ) as Config['layout'][number];
        assert.equal(entry.h, 6);
        assert.equal(entry.y, 0);
        await page.getByRole('button', {name: 'Apply drop', exact: true}).click();
        await expect
            .poll(
                async () =>
                    (
                        JSON.parse(
                            checked(await page.locator('[data-qa="saved-config"]').textContent()),
                        ) as Config
                    ).items.length,
            )
            .toBe(before.items.length + 1);
        const after = JSON.parse(
            checked(await page.locator('[data-qa="saved-config"]').textContent()),
        ) as Config;
        assert.equal(checked(after.layout.find(({i}) => i !== 'child')).h, 6);
        evidence.push({empty, before, entry, after});
    });
}

// Critical: yes. The drop callback must receive the caller's ID consistently through nested admission.
for (const nested of [false, true]) {
    test(`caller palette ID survives nested=${nested} and cancellation cleans preview`, async ({
        page,
        evidence,
    }) => {
        await page.goto(
            storyUrl('tests-gridstack--palette-document', {admission: nested, callerId: true}),
        );
        const target = page
            .locator(nested ? '[data-dashkit-id="allowed"] .grid-stack' : '.grid-stack')
            .first();
        await target.waitFor();
        const before = await page.locator('[data-qa="saved-config"]').textContent();
        await dropPalette(page, page.getByRole('button', {name: '+ Add', exact: true}), target, {
            x: 100,
            y: 5,
        });
        await expect(page.locator('[data-qa="drop-count"]')).toHaveText('1');
        const entry = JSON.parse(
            checked(await page.locator('[data-qa="drop-layout"]').textContent()),
        ) as Config['layout'][number];
        assert.equal(entry.i, 'caller-preview-id');
        assert.equal(entry.containerId, nested ? 'allowed' : undefined);
        await page.getByRole('button', {name: 'Cancel drop', exact: true}).click();
        await expect(page.locator('[data-dashkit-id="__dropping-elem__"]')).toHaveCount(0);
        assert.equal(await page.locator('[data-qa="saved-config"]').textContent(), before);
        evidence.push({nested, entry});
    });
}

// Critical: yes. Leaving onto an overlay must roll back preview-induced neighbour displacement before drag end.
test('palette overlay leave clears preview and restores displaced containers immediately', async ({
    page,
    evidence,
}) => {
    await page.goto(storyUrl('tests-gridstack--palette-document', {overlay: true}));
    const saved = page.locator('[data-qa="saved-config"]');
    const before = await saved.textContent();
    const boxY = () =>
        page
            .locator('[data-dashkit-id="box"]')
            .evaluate((el) => (el as NativeElement).gridstackNode.y);
    await hover(page);
    assert.equal(await boxY(), 2);
    const overlay = checked(await page.locator('[data-palette-overlay]').boundingBox());
    await page.mouse.move(overlay.x + 40, overlay.y + 40);
    await page.mouse.move(overlay.x + 41, overlay.y + 40);
    await expect(page.locator('[data-dashkit-id="__dropping-elem__"]')).toHaveCount(0);
    assert.equal(await boxY(), 0);
    assert.equal(await saved.textContent(), before);
    await page.mouse.up();
    await expect(page.locator('[data-qa="drop-count"]')).toHaveText('0');
    evidence.push({before, after: await saved.textContent()});
});

// Critical: yes. Native moves must use the same destination-membership veto as palette additions.
test('native widget respects blocked container admission membership', async ({page, evidence}) => {
    await page.goto(storyUrl('tests-gridstack--palette-document', {admission: true, native: true}));
    const host = page.locator('[data-dashkit-id="existing"]');
    await host.waitFor();
    const before = JSON.parse(
        checked(await page.locator('[data-qa="saved-config"]').textContent()),
    ) as Config;
    const source = checked(await host.boundingBox()),
        target = checked(
            await page.locator('[data-dashkit-id="blocked"] .grid-stack').boundingBox(),
        );
    await page.mouse.move(source.x + source.width / 2, source.y + source.height - 12);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 5, source.y + source.height - 7);
    await page.mouse.move(target.x + 100, target.y + 100, {steps: 12});
    await page.mouse.up();
    await expect(page.locator('[data-qa="admission-target"]')).toHaveAttribute(
        'data-container-id',
        'blocked',
    );
    await expect(host).toHaveCount(1);
    const after = JSON.parse(
        checked(await page.locator('[data-qa="saved-config"]').textContent()),
    ) as Config;
    assert.equal(after.layout[0].containerId, undefined);
    assert.deepEqual(after.containers, before.containers);
    evidence.push({before, after});
});
