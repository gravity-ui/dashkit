import assert from 'node:assert/strict';

import {expect} from '@playwright/test';

import type {Config} from '../../src/shared';

import {checked, test} from './fixtures';

// Critical: yes. A nested handle must not move or focus a different widget through its ancestor.
test('custom handles retain child ownership and container padding remains draggable without child focus', async ({
    page,
    evidence,
}) => {
    await page.goto('/iframe.html?id=tests-controlled-nesting--custom-handles&viewMode=story');
    const child = page.locator('[data-nested-widget="a"]');
    await child.waitFor();
    const saved = async () =>
        JSON.parse(
            checked(await page.locator('[data-qa="nested-config"]').textContent()),
        ) as Config;
    const original = await saved();
    const drag = async (x: number, y: number, dx: number, dy: number) => {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 5, y + 5);
        await page.mouse.move(x + dx, y + dy);
        await page.mouse.up();
    };
    const body = checked(await child.boundingBox());
    await drag(body.x + 50, body.y + 50, 20, 15);
    assert.deepEqual(await saved(), original);
    const handle = checked(await child.locator('.nested-drag-handle').boundingBox());
    await drag(handle.x + 5, handle.y + 5, 20, 15);
    await expect(page.locator('[data-qa="nesting-events"]')).toHaveText('1');
    const moved = await saved();
    assert.deepEqual(moved.containers, original.containers);
    assert.deepEqual(moved.layout[0], {...original.layout[0], x: 40, y: 35});
    await page.getByRole('button', {name: 'Restore nested', exact: true}).click();
    // Clear focus by mounting a fresh dashboard, then start from the container's own padding.
    await page.reload();
    await child.waitFor();
    const panel = checked(await page.locator('[data-dashkit-id="panel"]').boundingBox());
    await drag(panel.x + 5, panel.y + 5, 20, 15);
    await expect(page.locator('[data-qa="nesting-events"]')).toHaveText('1');
    assert.deepEqual((await saved()).containers, [
        {...checked(original.containers)[0], x: 20, y: 15},
    ]);
    await expect(page.locator('[data-qa="nested-focus"]')).toHaveText('');
    const resize = checked(
        await page.locator('[data-dashkit-id="panel"] > .ui-resizable-se').boundingBox(),
    );
    await drag(resize.x + resize.width / 2, resize.y + resize.height / 2, 20, 15);
    await expect(page.locator('[data-qa="nesting-events"]')).toHaveText('2');
    await expect(page.locator('[data-qa="nested-focus"]')).toHaveText('');
    const final = await saved();
    assert.deepEqual(final.containers, [
        {...checked(original.containers)[0], x: 20, y: 15, w: 420, h: 295},
    ]);
    assert.deepEqual(final.layout, original.layout);
    assert.deepEqual(checked(await page.locator('[data-dashkit-id="panel"]').boundingBox()), {
        x: panel.x + 20,
        y: panel.y + 15,
        width: 420,
        height: 295,
    });
    evidence.push({
        check: 'custom child handle, ancestor padding and focus ownership',
        original,
        moved,
        final,
    });
});

// Critical: yes. Native contained edits and controlled restores must retain local geometry and identity.
test('contained drag, resize, controlled reparent and revision cancellation preserve the next edit', async ({
    page,
    evidence,
}) => {
    await page.goto('/iframe.html?id=tests-controlled-nesting--contained&viewMode=story');
    const widget = page.locator('[data-nested-widget="a"]');
    await widget.waitFor();
    const saved = async () =>
        JSON.parse(
            checked(await page.locator('[data-qa="nested-config"]').textContent()),
        ) as Config;
    const original = await saved();
    const identity = await widget.getAttribute('data-instance');
    const before = checked(await widget.boundingBox());
    const drag = async (x: number, y: number, dx: number, dy: number) => {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 5, y + 5);
        await page.mouse.move(x + dx, y + dy);
        await page.mouse.up();
    };
    await drag(before.x + 30, before.y + 30, 30, 25);
    await expect(page.locator('[data-qa="nesting-events"]')).toHaveText('1');
    const moved = await saved();
    assert.deepEqual(moved.layout, [{...original.layout[0], x: 50, y: 45}, original.layout[1]]);
    assert.deepEqual(moved.containers, original.containers);
    const handle = checked(
        await page.locator('[data-dashkit-id="a"] > .ui-resizable-se').boundingBox(),
    );
    await drag(handle.x + handle.width / 2, handle.y + handle.height / 2, 20, 15);
    await expect(page.locator('[data-qa="nesting-events"]')).toHaveText('2');
    const resized = await saved();
    assert.deepEqual(resized.layout, [{...moved.layout[0], w: 120, h: 85}, original.layout[1]]);
    const visible = checked(await widget.boundingBox());
    assert.equal(visible.width, 120);
    assert.equal(visible.height, 85);
    await page.getByRole('button', {name: 'Restore nested', exact: true}).click();
    assert.deepEqual(await saved(), original);
    assert.deepEqual(checked(await widget.boundingBox()), before);
    await page.getByRole('button', {name: 'Reparent to root', exact: true}).click();
    assert.equal(await widget.getAttribute('data-instance'), identity);
    assert.equal((await saved()).layout[0].containerId, undefined);
    await expect(page.locator('[data-qa="nesting-events"]')).toHaveText('2');
    // Replace the controlled revision while native dragging is active, then release the old pointer.
    const root = checked(await widget.boundingBox());
    await page.mouse.move(root.x + 30, root.y + 30);
    await page.mouse.down();
    await page.mouse.move(root.x + 50, root.y + 40);
    await page
        .getByRole('button', {name: 'Restore nested', exact: true})
        .evaluate((el: HTMLButtonElement) => el.click());
    await page.mouse.up();
    assert.deepEqual(await saved(), original);
    await expect(page.locator('[data-qa="nesting-events"]')).toHaveText('2');
    const restored = checked(await widget.boundingBox());
    await drag(restored.x + 30, restored.y + 30, 20, 15);
    await expect(page.locator('[data-qa="nesting-events"]')).toHaveText('3');
    assert.deepEqual((await saved()).layout, [
        {...original.layout[0], x: 40, y: 35},
        original.layout[1],
    ]);
    assert.equal(await widget.getAttribute('data-instance'), identity);
    evidence.push({
        check: 'contained edits, silent restore/reparent, revision cancellation and next edit',
        original,
        moved,
        resized,
    });
});

test('public nested example renders saved containers without browser errors', async ({
    page,
    evidence,
}) => {
    await page.goto('/iframe.html?id=gridstack--nested-containers&viewMode=story');
    await expect(page.locator('[data-qa="dashkit-grid-item"]')).toHaveCount(2);
    await expect(page.locator('[data-dashkit-id="panel"] .grid-stack')).toHaveCount(1);
    await expect(
        page.locator('[data-dashkit-id="panel"]').getByText('Native flat layout', {exact: true}),
    ).toHaveCount(1);
    await expect(
        page.locator('[data-dashkit-id="panel"]').getByText('Nested widget', {exact: true}),
    ).toHaveCount(1);
    evidence.push({check: 'public nested example renders two widgets in one saved container'});
});
