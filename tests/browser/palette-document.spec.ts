import assert from 'node:assert/strict';

import {expect} from '@playwright/test';
import type {Page} from '@playwright/test';

import type {Config} from '../../src/shared';

import {checked, dropPalette, storyUrl, test} from './fixtures';
import type {NativeElement} from './types';

async function hoverPalette(page: Page) {
    const source = page.getByRole('button', {name: '+ Add', exact: true});
    const root = page.locator('.grid-stack').first();
    await page.locator('[data-dashkit-id="child"]').waitFor();
    const from = checked(await source.boundingBox());
    const to = checked(await root.boundingBox());
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, {steps: 3});
    // Stay just outside the snapped preview so mounting it cannot change the native drop target.
    await page.mouse.move(to.x + 145, to.y + 5);
    await page.mouse.move(to.x + 145, to.y + 5);
    await expect(page.locator('[data-qa="hover-count"]')).not.toHaveText('0');
}

// Critical: yes. Parent hover feedback must not discard an accepted public palette drop.
// Real pointer release after the callback rerender catches context cancellation missed by units.
test('native palette survives public hover callback rerenders until pointer release', async ({
    page,
    evidence,
}) => {
    await page.goto(storyUrl('tests-gridstack--palette-document', {rerenderOnHover: true}));
    await page.locator('[data-dashkit-id="child"]').waitFor();
    const saved = page.locator('[data-qa="saved-config"]');
    const before = await saved.textContent();
    const boxY = () =>
        page
            .locator('[data-dashkit-id="box"]')
            .evaluate((element) => (element as NativeElement).gridstackNode.y);
    await hoverPalette(page);
    await expect(page.locator('[data-dashkit-id="__dropping-elem__"]')).toHaveCount(1);
    assert.equal(await boxY(), 2);
    const hovers = await page.locator('[data-qa="hover-count"]').textContent();
    // Release without another dragover after React commits the parent's hover feedback.
    await page.mouse.up();
    await expect(page.locator('[data-qa="drop-count"]')).toHaveText('1');
    assert.equal(await saved.textContent(), before);
    assert(
        Number(await page.locator('[data-qa="drop-hover-count"]').textContent()) >= Number(hovers),
    );
    assert.equal(await boxY(), 2);
    await page.getByRole('button', {name: 'Cancel drop'}).click();
    await expect(page.locator('[data-dashkit-id="__dropping-elem__"]')).toHaveCount(0);
    assert.equal(await saved.textContent(), before);
    assert.equal(await boxY(), 0);

    await hoverPalette(page);
    await page.mouse.up();
    await expect(page.locator('[data-qa="drop-count"]')).toHaveText('2');
    await page.getByRole('button', {name: 'Apply drop'}).click();
    await expect
        .poll(async () => (JSON.parse(checked(await saved.textContent())) as Config).items.length)
        .toBe(2);
    assert.equal(await boxY(), 2);
    await expect(page.locator('[data-qa="change-count"]')).toHaveText('0');
    evidence.push({
        check: 'callback rerender retains current onDrop, cancel restores neighbors, next drop saves',
    });
});

test('native palette uses the current admission callback after parent hover feedback', async ({
    page,
    evidence,
}) => {
    await page.goto(
        storyUrl('tests-gridstack--palette-document', {
            rerenderOnHover: true,
            rejectAfterHover: true,
        }),
    );
    await page.locator('[data-dashkit-id="child"]').waitFor();
    const before = await page.locator('[data-qa="saved-config"]').textContent();
    await page
        .locator('.grid-stack')
        .first()
        .evaluate((element) => {
            element.addEventListener('dragover', () => {
                if (element.querySelector('[data-dashkit-id="__dropping-elem__"]')) {
                    element.setAttribute('data-admitted-preview', 'true');
                }
            });
        });
    await hoverPalette(page);
    const root = checked(await page.locator('.grid-stack').first().boundingBox());
    await page.mouse.move(root.x + 146, root.y + 5);
    await page.mouse.move(root.x + 146, root.y + 5);
    await expect(page.locator('[data-dashkit-id="__dropping-elem__"]')).toHaveCount(0);
    await expect(page.locator('.grid-stack').first()).toHaveAttribute(
        'data-admitted-preview',
        'true',
    );
    assert(Number(await page.locator('[data-qa="hover-count"]').textContent()) > 1);
    await page.mouse.up();
    await expect(page.locator('[data-qa="drop-count"]')).toHaveText('0');
    assert.equal(await page.locator('[data-qa="saved-config"]').textContent(), before);
    assert.equal(
        await page
            .locator('[data-dashkit-id="box"]')
            .evaluate((element) => (element as NativeElement).gridstackNode.y),
        0,
    );
    evidence.push({
        check: 'changed admission closure vetoes next hover and restores displaced neighbor',
    });
});

test('native palette admission distinguishes sibling containers in one zone', async ({
    page,
    evidence,
}) => {
    await page.goto(storyUrl('tests-gridstack--palette-admission'));
    const source = page.getByRole('button', {name: '+ Add', exact: true});
    const saved = async (): Promise<Config> =>
        JSON.parse(checked(await page.locator('[data-qa="saved-config"]').textContent()));
    const before = await saved();
    const blocked = page.locator('[data-dashkit-id="blocked"] .grid-stack');
    const allowed = page.locator('[data-dashkit-id="allowed"] .grid-stack');
    await blocked.waitFor();
    await source.dragTo(blocked, {targetPosition: {x: 100, y: 100}});
    await expect(page.locator('[data-qa="admission-target"]')).toHaveAttribute(
        'data-container-id',
        'blocked',
    );
    await expect(page.locator('[data-dashkit-id="__dropping-elem__"]')).toHaveCount(0);
    await expect(page.locator('[data-qa="drop-count"]')).toHaveText('0');
    assert.deepEqual(await saved(), before);

    await dropPalette(page, source, allowed, {x: 100, y: 100});
    await expect(page.locator('[data-qa="admission-target"]')).toHaveAttribute(
        'data-container-id',
        'allowed',
    );
    await expect(page.locator('[data-qa="drop-count"]')).toHaveText('1');
    assert.deepEqual(await saved(), before, 'pending drop must not save');
    await page.getByRole('button', {name: 'Apply drop'}).click();
    await expect.poll(async () => (await saved()).items.length).toBe(1);
    const after = await saved();
    assert.equal(after.layout[0].containerId, 'allowed');
    assert.equal(after.layout[0].parent, undefined);
    evidence.push({
        check: 'sibling container admission gates preview and saved membership',
        before,
        after,
    });
});

test('native palette preventCollision rejects occupied drop and keeps valid preview', async ({
    page,
    evidence,
}) => {
    await page.goto(storyUrl('tests-gridstack--collision'));
    const source = page.getByRole('button', {name: '+ Widget', exact: true});
    const root = page.locator('.grid-stack').first();
    const preview = root.locator('[data-dashkit-id="__dropping-elem__"]');
    const saved = async (): Promise<Config> =>
        JSON.parse(checked(await page.locator('[data-qa="saved-config"]').textContent()));
    const positions = () =>
        root.evaluate((element) =>
            ['a', 'b'].map((id) => {
                const node = element.querySelector<NativeElement>(
                    `[data-dashkit-id="${id}"]`,
                )?.gridstackNode;
                if (!node) {
                    throw new Error(`Missing native node ${id}`);
                }
                const {x, y, w, h} = node;
                return {id, x, y, w, h};
            }),
        );
    await root.waitFor();
    const before = await saved();
    const beforePositions = await positions();

    await root.evaluate((element) => {
        element.addEventListener('dragover', () => {
            const nodes = ['a', 'b'].map((id) => {
                const node = element.querySelector<NativeElement>(
                    `[data-dashkit-id="${id}"]`,
                )?.gridstackNode;
                if (!node) {
                    throw new Error(`Missing native node ${id}`);
                }
                const {x, y, w, h} = node;
                return {id, x, y, w, h};
            });
            element.setAttribute(
                'data-occupied-hover',
                JSON.stringify({
                    nodes,
                    preview: element.querySelectorAll('[data-dashkit-id="__dropping-elem__"]')
                        .length,
                }),
            );
        });
    });
    await source.dragTo(root, {targetPosition: {x: 100, y: 100}});
    const occupied = JSON.parse(checked(await root.getAttribute('data-occupied-hover')));
    assert.deepEqual(occupied, {nodes: beforePositions, preview: 0});
    await expect(preview).toHaveCount(0);
    await expect(page.locator('[data-qa="drop-count"]')).toHaveText('0');
    assert.deepEqual(await saved(), before);
    assert.deepEqual(await positions(), beforePositions);

    await root.evaluate((element) => {
        const counts: number[] = [];
        let repeated = false;
        element.addEventListener('dragover', (event) => {
            const count = element.querySelectorAll('[data-dashkit-id="__dropping-elem__"]').length;
            counts.push(count);
            element.setAttribute('data-preview-counts', JSON.stringify(counts));
            if (count === 1 && !repeated) {
                repeated = true;
                const {clientX, clientY} = event as DragEvent;
                element.dispatchEvent(
                    new DragEvent('dragover', {
                        bubbles: true,
                        cancelable: true,
                        clientX,
                        clientY,
                    }),
                );
            }
        });
    });
    await source.dragTo(root, {targetPosition: {x: 500, y: 200}});
    const counts = JSON.parse(checked(await root.getAttribute('data-preview-counts'))) as number[];
    assert(counts.some((count, index) => count === 1 && counts[index + 1] === 1));

    await expect(page.locator('[data-qa="drop-count"]')).toHaveText('1');
    const after = await saved();
    assert.equal(after.items.length, before.items.length + 1);
    assert.deepEqual(after.layout.slice(0, 2), before.layout);
    assert.deepEqual(await positions(), beforePositions);
    evidence.push({
        check: 'occupied palette rejected; repeated valid hover and one saved drop',
        before,
        after,
    });
});

// Critical: yes. Native container displacement must survive public controlled palette saves.
// Widget-only payload checks miss overlapping saved containers and lost descendant geometry.
test('native palette keeps displaced subtree through pending drop, cancel and controlled apply', async ({
    page,
    evidence,
}) => {
    await page.goto(storyUrl('tests-gridstack--palette-document'));
    const host = (id: string) => page.locator(`[data-dashkit-id="${id}"]`);
    const saved = async (): Promise<Config> =>
        JSON.parse(checked(await page.locator('[data-qa="saved-config"]').textContent()));
    const position = (id: string) =>
        host(id).evaluate((element) => {
            const {x, y, w, h} = (element as NativeElement).gridstackNode;
            return {x, y, w, h};
        });
    await host('child').waitFor();
    const before = await saved();
    const identity = await page
        .locator('[data-palette-child="child"]')
        .getAttribute('data-identity');
    const inner = await position('inner');
    const child = await position('child');
    const childRect = checked(await host('child').boundingBox());
    const boxRect = checked(await host('box').boundingBox());
    const drop = async () => {
        const root = page.locator('.grid-stack').first();
        // Capture the admitted preview before the public callback can reconcile controlled props.
        await root.evaluate((element) => {
            element.addEventListener(
                'drop',
                () => {
                    const previewBox =
                        element.querySelector<NativeElement>('[data-dashkit-id="box"]');
                    if (previewBox) {
                        const {x, y, w, h} = previewBox.gridstackNode;
                        element.setAttribute('data-drop-preview', JSON.stringify({x, y, w, h}));
                    }
                },
                {capture: true, once: true},
            );
        });
        await dropPalette(page, page.getByRole('button', {name: '+ Add', exact: true}), root, {
            x: 155,
            y: 5,
        });
        const preview = JSON.parse(checked(await root.getAttribute('data-drop-preview')));
        assert.deepEqual(preview, {x: 4, y: 2, w: 4, h: 4});
        assert.deepEqual(await saved(), before, 'pending preview must not save');
        evidence.push({check: 'real pointer preview at drop', preview, saved: await saved()});
    };
    await drop();
    await expect(page.getByRole('button', {name: 'Apply drop'})).toBeEnabled();
    const pendingBox = await position('box');
    await expect(host('__dropping-elem__')).toHaveCount(1);
    assert.deepEqual(pendingBox, {x: 4, y: 2, w: 4, h: 4});
    evidence.push({check: 'pending public drop', box: pendingBox, saved: await saved()});
    await page.getByRole('button', {name: 'Apply drop'}).click();
    await expect.poll(async () => (await saved()).items.length).toBe(2);
    const after = await saved();
    evidence.push({check: 'controlled public setItem save', after, box: await position('box')});
    assert.equal(checked(after.containers?.find(({id}) => id === 'box')).y, 2);
    assert.deepEqual(pendingBox, {x: 4, y: 2, w: 4, h: 4});
    assert.deepEqual(await position('box'), pendingBox);
    assert.deepEqual(await host('box').boundingBox(), {...boxRect, y: boxRect.y + 80});
    assert.deepEqual(await host('child').boundingBox(), {...childRect, y: childRect.y + 80});
    const added = checked(after.layout.find(({i}) => i !== 'child'));
    assert.deepEqual(await position(added.i), {x: 3, y: 0, w: 3, h: 2});
    assert.equal(
        added.y + added.h,
        checked(after.containers?.[0]).y,
        'saved siblings must not overlap',
    );
    assert.deepEqual(
        after.layout.find(({i}) => i === 'child'),
        before.layout[0],
    );
    assert.deepEqual(after.containers?.[1], before.containers?.[1]);
    assert.deepEqual(await position('inner'), inner);
    assert.deepEqual(await position('child'), child);
    assert.equal(
        await page.locator('[data-palette-child="child"]').getAttribute('data-identity'),
        identity,
    );
    await expect(page.locator('[data-qa="drop-count"]')).toHaveText('1');
    await expect(page.locator('[data-qa="change-count"]')).toHaveText('0');

    await page.goto(storyUrl('tests-gridstack--palette-document'));
    await host('child').waitFor();
    const cancelIdentity = await page
        .locator('[data-palette-child="child"]')
        .getAttribute('data-identity');
    await drop();
    await page.getByRole('button', {name: 'Cancel drop'}).click();
    await expect(host('__dropping-elem__')).toHaveCount(0);
    assert.deepEqual(await saved(), before);
    assert.equal(
        await page.locator('[data-palette-child="child"]').getAttribute('data-identity'),
        cancelIdentity,
    );
    await expect(page.locator('[data-qa="drop-count"]')).toHaveText('1');
    assert.deepEqual(await position('box'), {x: 4, y: 0, w: 4, h: 4});
    assert.deepEqual(await position('inner'), inner);
    assert.deepEqual(await position('child'), child);
    await expect(page.locator('[data-qa="change-count"]')).toHaveText('0');
});
