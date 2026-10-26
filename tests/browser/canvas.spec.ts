import assert from 'node:assert/strict';

import type {Page} from '@playwright/test';

import type {Config} from '../../src/shared';

import {checked, storyUrl, test} from './fixtures';
import type {NativeElement} from './types';
const near = (actual: number, expected: number) =>
    assert(Math.abs(actual - expected) <= 1, `${actual} != ${expected}`);
function canvas(page: Page) {
    const state = () =>
        page.evaluate(() => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            return {
                engine: document.querySelector<NativeElement>('[data-dashkit-engine]')?.dataset
                    .dashkitEngine,
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
                        rect: el.getBoundingClientRect().toJSON(),
                    }),
                ),
                root: required(document.querySelector<NativeElement>('.grid-stack'))
                    .getBoundingClientRect()
                    .toJSON(),
            };
        });
    const reset = async () => {
        await page.goto(storyUrl('tests-gridstack--report-canvas'));
        await page.locator('[data-widget-id="b"]').waitFor();
        const result = await state();
        assert.equal(result.engine, 'gridstack');
        return result;
    };
    const drag = async (x: number, y: number, dx: number, dy: number, initialStep = 5) => {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + Math.sign(dx) * initialStep, y + Math.sign(dy) * initialStep);
        await page.mouse.move(x + dx, y + dy, {steps: 8});
        await page.mouse.up();
        await page.waitForFunction(() => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            return (
                required(
                    required(document.querySelector<NativeElement>('[data-qa="event-count"]'))
                        .textContent,
                ) !== 'Events: 0'
            );
        });
    };
    const widget = (data: Awaited<ReturnType<typeof state>>, id: string) =>
        data.widgets.find((entry) => entry.id === id);
    const layout = (data: Awaited<ReturnType<typeof state>>, id: string) =>
        data.config.layout.find((entry) => entry.i === id);
    return {state, reset, drag, widget, layout};
}
// Critical: yes. Real pointer actions must retain the saved document and plugin identity.
test('portal flex geometry and passive resize preserve identity', async ({page, evidence}) => {
    await page.goto(storyUrl('tests-gridstack--portal-flex-zones'));
    await page.locator('[data-portal-case]').last().waitFor();
    const portalState = () =>
        page.evaluate(() => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            return [...document.querySelectorAll<NativeElement>('[data-portal-case]')].map(
                (owner) => {
                    const target = owner.querySelector<NativeElement>('[data-portal-target]');
                    const zone =
                        required(target).querySelector<NativeElement>('.dashkit-gridstack__zone') ||
                        owner.querySelector<NativeElement>('.dashkit-gridstack__zone');
                    const root = zone?.querySelector<NativeElement>('.grid-stack');
                    const panel = root?.querySelector<NativeElement>('[data-dashkit-id="panel"]');
                    const nested = panel?.querySelector<NativeElement>('.grid-stack');
                    const child = panel?.querySelector<NativeElement>('[data-widget-id="b"]');
                    return {
                        name: owner.getAttribute('data-portal-case'),
                        frame: required(
                            owner.querySelector<NativeElement>('[data-portal-frame]'),
                        ).getBoundingClientRect().width,
                        flex: required(
                            owner.querySelector<NativeElement>('[data-portal-flex-item]'),
                        ).getBoundingClientRect().width,
                        zone: zone?.getBoundingClientRect().toJSON(),
                        root: root?.getBoundingClientRect().toJSON(),
                        outside: zone
                            ? !required(
                                  owner.querySelector<NativeElement>('[data-dashkit-engine]'),
                              ).contains(zone)
                            : null,
                        containment: zone ? getComputedStyle(zone).contain : null,
                        panel: panel?.getBoundingClientRect().toJSON(),
                        nested: nested?.getBoundingClientRect().toJSON(),
                        child: child?.getBoundingClientRect().toJSON(),
                        identities: [
                            ...owner.querySelectorAll<NativeElement>('[data-widget-id]'),
                        ].map((el) => [el.dataset.widgetId, el.dataset.widgetInstance]),
                        events: required(
                            required(owner.querySelector<NativeElement>('[data-portal-events]'))
                                .textContent,
                        ),
                        ancestors: zone
                            ? [
                                  zone,
                                  target,
                                  required(target).parentElement,
                                  required(required(target).parentElement).parentElement,
                              ].map((el) => ({
                                  className: required(el).className,
                                  width: required(el).getBoundingClientRect().width,
                                  display: getComputedStyle(required(el)).display,
                                  minWidth: getComputedStyle(required(el)).minWidth,
                                  contain: getComputedStyle(required(el)).contain,
                              }))
                            : [],
                    };
                },
            );
        });
    const frames = () =>
        page.evaluate(
            () =>
                new Promise<void>((resolve) => {
                    let count = 0;
                    const tick = () => (++count === 24 ? resolve() : requestAnimationFrame(tick));
                    requestAnimationFrame(tick);
                }),
        );
    const portalBefore = await portalState();
    for (const button of await page.getByRole('button', {name: 'Toggle pin', exact: true}).all()) {
        await button.click();
    }
    await frames();
    const pinned = await portalState();
    await frames();
    const settled = await portalState();
    evidence.push({
        check: 'portal/flex source and pinned ancestors after two native frame windows',
        before: portalBefore,
        pinned,
        settled,
    });
    for (const [index, entry] of settled.entries()) {
        assert.equal(entry.outside, true);
        assert.equal(entry.flex, entry.frame - 80);
        assert.equal(
            entry.zone.width,
            checked(entry.name).startsWith('explicit') ? 384 : entry.frame - 80,
        );
        near(entry.root.width, entry.zone.width + 8);
        near(entry.zone.height, checked(entry.name).endsWith('fixed') ? 180 : 138);
        assert.equal(entry.zone.width, pinned[index].zone.width);
        near(entry.nested.x - entry.panel.x, 11);
        near(entry.nested.y - entry.panel.y, 3);
        near(entry.nested.width, entry.panel.width - 8 - 11 - 7 + 4);
        near(entry.child.x, entry.nested.x);
        near(entry.child.y, entry.nested.y);
        near(entry.child.width, entry.nested.width / 2 - 4);
        near(entry.child.height, 38);
        assert.deepEqual(entry.identities, portalBefore[index].identities);
        assert.equal(entry.events, '0');
    }
    await page.evaluate(() =>
        document
            .querySelectorAll<NativeElement>('[data-portal-case]')
            .forEach((el) => el.style.setProperty('width', '520px')),
    );
    await frames();
    const resized = await portalState();
    for (const entry of resized) {
        assert.equal(entry.flex, 440);
        assert.equal(entry.zone.width, checked(entry.name).startsWith('explicit') ? 384 : 440);
        near(entry.zone.height, checked(entry.name).endsWith('fixed') ? 180 : 138);
        assert.equal(entry.events, '0');
    }
    for (const button of await page.getByRole('button', {name: 'Toggle pin', exact: true}).all()) {
        await button.click();
    }
    await frames();
    const unpinned = await portalState();
    unpinned.forEach((entry, index) => {
        assert.equal(entry.outside, false);
        assert.equal(entry.zone.width, checked(entry.name).startsWith('explicit') ? 384 : 520);
        near(entry.zone.height, checked(entry.name).endsWith('fixed') ? 180 : 138);
        assert.deepEqual(entry.identities, portalBefore[index].identities);
        assert.equal(entry.events, '0');
    });
    evidence.push({
        check: 'portal fluid/explicit width, auto/fixed height, nested hosts, passive flex resize and unpin retain plugins without change events',
        resized,
        unpinned,
    });
});
// Critical: yes. Real pointer actions must retain the saved document and plugin identity.
test('native overlapping drag and controlled restore preserve identity', async ({
    page,
    evidence,
}) => {
    const {state, reset, drag, widget, layout} = canvas(page);
    const before = await reset();
    const rect = checked(widget(before, 'a')).rect;
    const overlapDelta = {x: 45, y: 35};
    await drag(rect.x + 30, rect.y + 60, overlapDelta.x, overlapDelta.y);
    let after = await state();
    assert.equal(checked(layout(after, 'a')).x, checked(layout(before, 'a')).x + overlapDelta.x);
    assert.equal(checked(layout(after, 'a')).y, checked(layout(before, 'a')).y + overlapDelta.y);
    assert.deepEqual(layout(after, 'b'), layout(before, 'b'));
    assert.equal(checked(widget(after, 'a')).instance, checked(widget(before, 'a')).instance);
    assert.equal(after.events, 'Events: 1');
    evidence.push({
        check: 'native overlapping drag, one event, stable instances',
        before,
        after,
    });
    await page.getByRole('button', {name: 'Restore', exact: true}).click();
    after = await state();
    assert.deepEqual(after.config.layout, before.config.layout);
    near(checked(widget(after, 'a')).rect.x, rect.x);
    assert.equal(after.events, 'Events: 1');
    evidence.push({check: 'controlled restore without echo event', after});
});

test('controlled layer order changes overlap hit testing without remount', async ({
    page,
    evidence,
}) => {
    const {state, reset, widget} = canvas(page);
    const before = await reset();
    const hit = () =>
        page.evaluate(() =>
            document
                .elementFromPoint(150, 150)
                ?.closest('[data-dashkit-id]')
                ?.getAttribute('data-dashkit-id'),
        );
    assert.equal(await hit(), 'b');
    await page.getByRole('button', {name: 'Reverse layers', exact: true}).click();
    assert.equal(await hit(), 'a');
    const after = await state();
    assert.equal(checked(widget(after, 'a')).instance, checked(widget(before, 'a')).instance);
    assert.equal(checked(widget(after, 'b')).instance, checked(widget(before, 'b')).instance);
    assert.equal(after.events, before.events);
    evidence.push({
        check: 'controlled item order changes overlap hit testing without remount',
        after,
    });
});

for (const corner of ['nw', 'ne', 'sw', 'se']) {
    test(`native ${corner} corner resize anchors the opposite corner`, async ({page, evidence}) => {
        const {state, reset, drag, widget, layout} = canvas(page);
        const before = await reset();
        const handle = await page
            .locator(`[data-dashkit-id="b"] .ui-resizable-${corner}`)
            .boundingBox();
        await drag(
            checked(handle).x + checked(handle).width / 2,
            checked(handle).y + checked(handle).height / 2,
            corner.includes('w') ? -25 : 25,
            corner.includes('n') ? -25 : 25,
        );
        const after = await state();
        const old = checked(widget(before, 'b')).rect;
        const next = checked(widget(after, 'b')).rect;
        assert(next.width > old.width && next.height > old.height);
        near(
            corner.includes('w') ? next.right : next.left,
            corner.includes('w') ? old.right : old.left,
        );
        near(
            corner.includes('n') ? next.bottom : next.top,
            corner.includes('n') ? old.bottom : old.top,
        );
        near(next.width, checked(layout(after, 'b')).w);
        near(next.height, checked(layout(after, 'b')).h);
        assert.deepEqual(layout(after, 'a'), layout(before, 'a'));
        assert.equal(checked(widget(after, 'b')).instance, checked(widget(before, 'b')).instance);
        assert.equal(after.events, 'Events: 1');
        evidence.push({
            check: `native ${corner} corner, anchored opposite corner and saved size`,
            before,
            after,
        });
    });
}

test('half-scale drag and resize preserve unscaled geometry', async ({page, evidence}) => {
    const {state, reset, drag, widget, layout} = canvas(page);
    let before = await reset();
    await page.getByRole('button', {name: 'Toggle zoom', exact: true}).click();
    before = await state();
    const rect = checked(widget(before, 'a')).rect;
    const zoom = 0.5;
    const zoomDelta = {x: 25, y: 25};
    await drag(rect.x + 15, rect.y + 30, zoomDelta.x, zoomDelta.y);
    let after = await state();
    assert.equal(
        checked(layout(after, 'a')).x - checked(layout(before, 'a')).x,
        zoomDelta.x / zoom,
    );
    assert.equal(
        checked(layout(after, 'a')).y - checked(layout(before, 'a')).y,
        zoomDelta.y / zoom,
    );
    assert.deepEqual(layout(after, 'b'), layout(before, 'b'));
    evidence.push({
        check: 'native CSS scale 0.5 drag converts screen delta into pixel units',
        before,
        after,
    });
    const scaledHandle = await page.locator('[data-dashkit-id="b"] .ui-resizable-se').boundingBox();
    const scaledBefore = checked(widget(after, 'b')).rect;
    await drag(
        checked(scaledHandle).x + checked(scaledHandle).width / 2,
        checked(scaledHandle).y + checked(scaledHandle).height / 2,
        12,
        12,
    );
    after = await state();
    assert.equal(checked(layout(after, 'b')).w, 204);
    assert.equal(checked(layout(after, 'b')).h, 144);
    near(checked(widget(after, 'b')).rect.left, scaledBefore.left);
    near(checked(widget(after, 'b')).rect.top, scaledBefore.top);
    evidence.push({
        check: 'native scaled corner resize keeps opposite corner anchored in unscaled units',
        after,
    });
});

for (const [kind, fixtureUrl] of [
    ['scalar', storyUrl('tests-gridstack--scalar-zoom')],
    ['ref', storyUrl('tests-gridstack--report-canvas')],
]) {
    test(`native ${kind} scale2 drag preserves geometry and identity`, async ({page, evidence}) => {
        const {state, drag, widget, layout} = canvas(page);
        await page.setViewportSize({width: 1800, height: 1200});
        const scale = 2;
        const scaledDelta = {x: 90, y: 70};
        await page.goto(fixtureUrl);
        await page.locator('[data-widget-id="a"]').waitFor();
        const renderCount = await page
            .locator('[data-widget-id="a"]')
            .getAttribute('data-widget-renders');
        await page
            .getByRole('button', {name: kind === 'scalar' ? 'Zoom2' : 'Ref2', exact: true})
            .click();
        if (kind === 'ref') {
            assert.equal(
                await page.locator('[data-widget-id="a"]').getAttribute('data-widget-renders'),
                renderCount,
            );
        }
        const before = await state();
        near(checked(widget(before, 'a')).rect.width, 320);
        const rect = checked(widget(before, 'a')).rect;
        await drag(rect.x + 60, rect.y + 120, scaledDelta.x, scaledDelta.y, 10);
        const after = await state();
        assert.equal(
            checked(layout(after, 'a')).x,
            checked(layout(before, 'a')).x + scaledDelta.x / scale,
        );
        assert.equal(
            checked(layout(after, 'a')).y,
            checked(layout(before, 'a')).y + scaledDelta.y / scale,
        );
        assert.deepEqual(layout(after, 'b'), layout(before, 'b'));
        assert.equal(checked(widget(after, 'a')).instance, checked(widget(before, 'a')).instance);
        evidence.push({
            check:
                kind === 'scalar'
                    ? 'native scalar scale2 drag preserves unscaled delta and identity'
                    : 'mutable scaleRef changed without React rerender drives native scale2 drag',
            before,
            after,
        });
    });
}

for (const edge of ['n', 's', 'e', 'w'] as const) {
    test(`native ${edge} edge resize anchors the opposite edge`, async ({page, evidence}) => {
        const {state, drag, widget, layout} = canvas(page);
        await page.setViewportSize({width: 1000, height: 1000});
        await page.goto(storyUrl('tests-gridstack--all-handles'));
        await page.locator('[data-widget-id="b"]').waitFor();
        const before = await state();
        const handle = await page
            .locator(`[data-dashkit-id="b"] .ui-resizable-${edge}`)
            .boundingBox();
        await drag(
            checked(handle).x + checked(handle).width / 2,
            checked(handle).y + checked(handle).height / 2,
            {e: 25, w: -25, n: 0, s: 0}[edge],
            {s: 25, n: -25, e: 0, w: 0}[edge],
        );
        const after = await state();
        const old = checked(widget(before, 'b')).rect,
            next = checked(widget(after, 'b')).rect;
        if (edge === 'n' || edge === 's') {
            assert.equal(checked(layout(after, 'b')).w, 180);
            assert.equal(checked(layout(after, 'b')).h, 145);
            near(next.left, old.left);
            near(edge === 'n' ? next.bottom : next.top, edge === 'n' ? old.bottom : old.top);
        } else {
            assert.equal(checked(layout(after, 'b')).w, 205);
            assert.equal(checked(layout(after, 'b')).h, 120);
            near(next.top, old.top);
            near(edge === 'w' ? next.right : next.left, edge === 'w' ? old.right : old.left);
        }
        assert.deepEqual(layout(after, 'a'), layout(before, 'a'));
        evidence.push({
            check: `native ${edge.toUpperCase()} edge resize anchors opposite edge and preserves neighbor`,
            before,
            after,
        });
    });
}

test('native drag clamps to right and bottom bounds', async ({page, evidence}) => {
    const {state, reset, drag, widget, layout} = canvas(page);
    const before = await reset();
    const rect = checked(widget(before, 'b')).rect;
    await drag(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        before.root.right - 10 - rect.x - rect.width / 2,
        before.root.bottom - 10 - rect.y - rect.height / 2,
    );
    const after = await state();
    assert.equal(checked(layout(after, 'b')).x + checked(layout(after, 'b')).w, 640);
    assert.equal(checked(layout(after, 'b')).y + checked(layout(after, 'b')).h, 400);
    assert.deepEqual(layout(after, 'a'), layout(before, 'a'));
    evidence.push({
        check: 'native drag clamps to fixed right and bottom bounds',
        before,
        after,
    });
});

test('native drag clamps to left and top bounds', async ({page, evidence}) => {
    const {state, reset, drag, widget, layout} = canvas(page);
    const before = await reset();
    const rect = checked(widget(before, 'b')).rect;
    await drag(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        before.root.left + 10 - rect.x - rect.width / 2,
        before.root.top + 10 - rect.y - rect.height / 2,
    );
    const after = await state();
    assert.equal(checked(layout(after, 'b')).x, 0);
    assert.equal(checked(layout(after, 'b')).y, 0);
    assert.deepEqual(layout(after, 'a'), layout(before, 'a'));
    evidence.push({
        check: 'native drag beyond left/top clamps to origin without disturbing overlap neighbor',
        before,
        after,
    });
});

test('native palette drop preserves existing widgets', async ({page, evidence}) => {
    const {state, reset} = canvas(page);
    const before = await reset();
    await page
        .getByRole('button', {name: '+ Widget', exact: true})
        .dragTo(page.locator('.grid-stack').first(), {targetPosition: {x: 450, y: 300}});
    const after = await state();
    assert.equal(after.config.items.length, 3);
    assert.equal(after.config.counter, 2);
    const added = after.config.layout.find(
        (entry) => !before.config.layout.some((old) => old.i === entry.i),
    );
    assert.deepEqual(
        {x: checked(added).x, y: checked(added).y, w: checked(added).w, h: checked(added).h},
        {x: 450, y: 300, w: 100, h: 80},
    );
    assert.deepEqual(after.config.layout.slice(0, 2), before.config.layout);
    evidence.push({
        check: 'native HTML5 palette drop commits geometry and preserves existing widgets',
        before,
        after,
    });
});

test('focus, keyboard and visual autoheight survive editing', async ({page, evidence}) => {
    const {state, reset, drag, widget, layout} = canvas(page);
    await reset();
    await page.getByRole('button', {name: 'Toggle edit', exact: true}).click();
    await page.locator('[data-qa="dashkit-grid-item"]').first().focus();
    await page.waitForFunction(() => {
        function required<T>(value: T | null | undefined): T {
            if (value === null || value === undefined) {
                throw new Error('Missing native fixture value');
            }
            return value;
        }
        return (
            required(
                required(document.querySelector<NativeElement>('[data-qa="focused-item"]'))
                    .textContent,
            ) === 'a'
        );
    });
    assert(
        await page
            .locator('[data-dashkit-id="a"]')
            .evaluate((el) => el.classList.contains('dashkit-grid-item_is-focused')),
    );
    await page.getByRole('button', {name: 'Toggle edit', exact: true}).focus();
    await page.waitForFunction(() => {
        function required<T>(value: T | null | undefined): T {
            if (value === null || value === undefined) {
                throw new Error('Missing native fixture value');
            }
            return value;
        }
        return (
            required(
                required(document.querySelector<NativeElement>('[data-qa="focused-item"]'))
                    .textContent,
            ) === ''
        );
    });
    await page.keyboard.press('Tab');
    assert.equal(
        await page
            .getByRole('textbox', {name: 'Keyboard probe', exact: true})
            .evaluate((el) => el === document.activeElement),
        true,
    );
    await page.locator('[data-qa="grow-a"]').click();
    let after = await state();
    near(checked(widget(after, 'a')).rect.height, 140);
    assert.equal(checked(layout(after, 'a')).h, 100);
    assert.equal(after.events, 'Events: 0');
    await page.getByRole('button', {name: 'Toggle edit', exact: true}).click();
    const rect = checked(widget(after, 'a')).rect;
    await drag(rect.x + 30, rect.y + 100, 45, 35);
    after = await state();
    assert.equal(checked(layout(after, 'a')).h, 100);
    near(checked(widget(after, 'a')).rect.height, 140);
    await page.getByRole('button', {name: 'Toggle edit', exact: true}).click();
    await page.getByRole('button', {name: 'Reverse layers', exact: true}).click();
    await page.locator('[data-qa="reset-a"]').click();
    after = await state();
    near(checked(widget(after, 'a')).rect.height, 100);
    evidence.push({
        check: 'native focus callbacks/stacking and keyboard tab, visual autoheight survives move and reset preserves saved height',
        after,
    });
});

// Critical: yes. Real pointer actions must retain the saved document and plugin identity.
test('collision prevents displacement of the neighbor', async ({page, evidence}) => {
    const {state, drag, widget, layout} = canvas(page);
    await page.goto(storyUrl('tests-gridstack--collision'));
    await page.locator('[data-widget-id="b"]').waitFor();
    const before = await state();
    const rect = checked(widget(before, 'b')).rect;
    await drag(rect.x + 80, rect.y + 70, -200, 0);
    const after = await state();
    assert(
        checked(layout(after, 'b')).x >=
            checked(layout(after, 'a')).x + checked(layout(after, 'a')).w,
    );
    assert.deepEqual(layout(after, 'a'), layout(before, 'a'));
    evidence.push({
        check: 'native preventCollision stops before occupied rectangle without pushing its neighbor',
        before,
        after,
    });
});

test('horizontal nowrap resize consumes remaining width', async ({page, evidence}) => {
    const {state, drag, layout} = canvas(page);
    await page.goto(storyUrl('tests-gridstack--horizontal-nowrap'));
    await page.locator('[data-widget-id="b"]').waitFor();
    const before = await state();
    const resize = await page.locator('[data-dashkit-id="b"] .ui-resizable-se').boundingBox();
    await drag(
        checked(resize).x + checked(resize).width / 2,
        checked(resize).y + checked(resize).height / 2,
        600,
        0,
    );
    const after = await state();
    assert.equal(checked(layout(after, 'b')).x + checked(layout(after, 'b')).w, 640);
    assert.equal(checked(layout(after, 'b')).y, 0);
    assert.deepEqual(layout(after, 'a'), layout(before, 'a'));
    evidence.push({
        check: 'native horizontal-nowrap resize consumes remaining row width without wrapping or displacing neighbor',
        before,
        after,
    });
});

test('custom React handles retain plugin state', async ({page, evidence}) => {
    const {state, drag, widget, layout} = canvas(page);
    await page.goto(storyUrl('tests-gridstack--custom-handles'));
    await page.locator('[data-widget-id="b"]').waitFor();
    const before = await state();
    assert.equal(await page.locator('[data-dashkit-id="b"] [data-custom-handle]').count(), 4);
    const resize = await page
        .locator('[data-dashkit-id="b"] [data-custom-handle="se"]')
        .boundingBox();
    await drag(
        checked(resize).x + checked(resize).width / 2,
        checked(resize).y + checked(resize).height / 2,
        25,
        25,
    );
    const after = await state();
    assert.equal(checked(layout(after, 'b')).w, 205);
    assert.equal(checked(layout(after, 'b')).h, 145);
    assert.equal(checked(widget(after, 'b')).instance, checked(widget(before, 'b')).instance);
    evidence.push({
        check: 'custom React corner handle drives native resize and retains plugin state',
        before,
        after,
    });
});

test('nested transfer, resize and drag out preserve geometry and identity', async ({
    page,
    evidence,
}) => {
    const {state, drag, widget, layout} = canvas(page);
    const nestedURL = storyUrl('tests-gridstack--nested-containers');
    await page.goto(nestedURL);
    await page.locator('[data-widget-id="b"]').waitFor();
    let before = await state();
    const panel = await page.locator('[data-dashkit-id="panel"]').boundingBox();
    const child = await page.locator('[data-dashkit-id="panel"] .grid-stack').boundingBox();
    let rect = checked(widget(before, 'b')).rect;
    await drag(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        checked(child).x + 110 - rect.x - rect.width / 2,
        checked(child).y + 80 - rect.y - rect.height / 2,
    );
    let after = await state();
    assert.equal(checked(layout(after, 'b')).containerId, 'panel');
    assert.equal(checked(layout(after, 'b')).w, 9);
    assert.equal(checked(layout(after, 'b')).h, 5);
    assert.equal(checked(widget(after, 'b')).instance, checked(widget(before, 'b')).instance);
    near(
        checked(widget(after, 'b')).rect.x,
        checked(panel).x + 16 + checked(layout(after, 'b')).x * 21,
    );
    near(
        checked(widget(after, 'b')).rect.y,
        checked(panel).y + 12 + checked(layout(after, 'b')).y * 24,
    );
    near(checked(widget(after, 'b')).rect.width, 181);
    near(checked(widget(after, 'b')).rect.height, 114);
    assert.deepEqual(layout(after, 'a'), layout(before, 'a'));
    evidence.push({
        check: 'native nested transfer preserves identity and converts visible geometry with independent padding/gap',
        before,
        after,
    });
    assert.equal(await page.locator('[data-dashkit-id="b"] .ui-resizable-handle').count(), 4);
    const nestedHandle = await page.locator('[data-dashkit-id="b"] .ui-resizable-se').boundingBox();
    before = after;
    await drag(
        checked(nestedHandle).x + checked(nestedHandle).width / 2,
        checked(nestedHandle).y + checked(nestedHandle).height / 2,
        21,
        24,
    );
    after = await state();
    assert.equal(checked(layout(after, 'b')).w, 10);
    assert.equal(checked(layout(after, 'b')).h, 6);
    assert.equal(checked(widget(after, 'b')).instance, checked(widget(before, 'b')).instance);
    const parentHandle = await page
        .locator('[data-dashkit-id="panel"] > .ui-resizable-se')
        .boundingBox();
    await drag(
        checked(parentHandle).x + checked(parentHandle).width / 2,
        checked(parentHandle).y + checked(parentHandle).height / 2,
        -200,
        -200,
    );
    after = await state();
    const resizedPanel = await page.locator('[data-dashkit-id="panel"]').boundingBox();
    assert(
        checked(widget(after, 'b')).rect.right <=
            checked(resizedPanel).x + checked(resizedPanel).width - 20 + 1,
    );
    assert(
        checked(widget(after, 'b')).rect.bottom <=
            checked(resizedPanel).y + checked(resizedPanel).height - 24 + 1,
    );
    assert.equal(checked(widget(after, 'b')).instance, checked(widget(before, 'b')).instance);
    evidence.push({
        check: 'nested native handles inherit all corners and parent shrink retains child extents and identity',
        after,
        resizedPanel,
    });
    before = after;
    rect = checked(widget(before, 'b')).rect;
    await drag(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        before.root.x + 200 - rect.x - rect.width / 2,
        before.root.y + 300 - rect.y - rect.height / 2,
    );
    after = await state();
    assert.equal(checked(layout(after, 'b')).containerId, undefined);
    assert.equal(checked(widget(after, 'b')).instance, checked(widget(before, 'b')).instance);
    near(checked(widget(after, 'b')).rect.width, checked(widget(before, 'b')).rect.width);
    near(checked(widget(after, 'b')).rect.height, checked(widget(before, 'b')).rect.height);
    evidence.push({
        check: 'native nested drag out preserves unscaled size and widget state',
        before,
        after,
    });
});

test('cross-zone transfer preserves callback ordering and identity', async ({page, evidence}) => {
    const {state, drag, widget, layout} = canvas(page);
    const zonesURL = storyUrl('tests-gridstack--cross-zones');
    await page.goto(zonesURL);
    await page.locator('[data-widget-id="b"]').waitFor();
    const before = await state();
    const destination = await page.locator('.grid-stack').nth(1).boundingBox();
    const rect = checked(widget(before, 'b')).rect;
    await drag(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        checked(destination).x + 130 - rect.x - rect.width / 2,
        checked(destination).y + 100 - rect.y - rect.height / 2,
    );
    const after = await state();
    assert.equal(checked(layout(after, 'b')).parent, 'right');
    assert.equal(checked(layout(after, 'a')).parent, 'left');
    assert.equal(checked(widget(after, 'b')).instance, checked(widget(before, 'b')).instance);
    assert.equal(after.events, 'Events: 1');
    const callbacks = JSON.parse(
        checked(await page.locator('[data-qa="callback-log"]').textContent()),
    ) as Array<{
        phase: string;
        old: {
            minW: number;
        };
        next: {
            minW: number;
        };
        placeholder: {
            placeholder: boolean;
        } | null;
        group: string;
        ids: string[];
    }>;
    assert.deepEqual(
        callbacks.filter(({phase}) => phase !== 'move').map(({phase}) => phase),
        ['start', 'stop', 'grid', 'grid'],
    );
    assert.equal(callbacks[0].placeholder, null);
    assert.equal(checked(callbacks.find(({phase}) => phase === 'stop')).placeholder, null);
    const movement = callbacks.find(({phase}) => phase === 'move');
    assert(movement);
    assert.equal(movement.old.minW, 20);
    assert.equal(movement.next.minW, 20);
    assert.equal(checked(movement.placeholder).placeholder, true);
    assert.deepEqual(
        callbacks.filter(({phase}) => phase === 'grid').map(({group, ids}) => ({group, ids})),
        [
            {group: 'left', ids: ['a']},
            {group: 'right', ids: ['b']},
        ],
    );
    evidence.push({
        check: 'native sibling-zone transfer is one transaction and preserves plugin identity',
        before,
        after,
    });
});

test('dashboard view/edit and passive resize converge', async ({page, evidence}) => {
    const {state, widget} = canvas(page);
    await page.goto(storyUrl('tests-gridstack--dashboard'));
    await page.locator('[data-widget-id="b"]').waitFor();
    const before = await state();
    for (let count = 0; count < 6; count++) {
        await page.getByRole('button', {name: 'Toggle edit', exact: true}).click();
    }
    let after = await state();
    assert.equal(after.events, 'Events: 0');
    assert.deepEqual(after.config, before.config);
    assert.equal(checked(widget(after, 'a')).instance, checked(widget(before, 'a')).instance);
    assert.equal(checked(widget(after, 'b')).instance, checked(widget(before, 'b')).instance);
    evidence.push({
        check: 'mounted dashboard converges across six view/edit switches',
        before,
        after,
    });
    const widths = await page.evaluate(async () => {
        function required<T>(value: T | null | undefined): T {
            if (value === null || value === undefined) {
                throw new Error('Missing native fixture value');
            }
            return value;
        }
        const values = [];
        for (let count = 0; count < 12; count++) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            values.push(
                required(
                    document.querySelector<NativeElement>('.dashkit-gridstack__zone'),
                ).getBoundingClientRect().width,
            );
        }
        return values;
    });
    assert(
        widths.every((width) => Math.abs(width - widths[0]) < 1),
        JSON.stringify(widths),
    );
    await page.setViewportSize({width: 800, height: 1000});
    await page.waitForFunction(() => {
        function required<T>(value: T | null | undefined): T {
            if (value === null || value === undefined) {
                throw new Error('Missing native fixture value');
            }
            return value;
        }
        return (
            required(
                document.querySelector<NativeElement>('[data-widget-id="a"]'),
            ).getBoundingClientRect().width < 280
        );
    });
    after = await state();
    assert.deepEqual(after.config, before.config);
    assert.equal(checked(widget(after, 'a')).instance, checked(widget(before, 'a')).instance);
    assert.equal(after.events, 'Events: 0');
    evidence.push({
        check: 'fluid dashboard width converges and passive resize preserves config and identity',
        widths,
        after,
    });
});

test('short and empty zone heights match legacy', async ({page, evidence}) => {
    await page.setViewportSize({width: 800, height: 1000});
    await page.goto(storyUrl('tests-gridstack--height-compatibility'));
    await page.locator('[data-height-engine="gridstack"] [data-widget-id="a"]').waitFor();
    await page.waitForFunction(() => {
        function required<T>(value: T | null | undefined): T {
            if (value === null || value === undefined) {
                throw new Error('Missing native fixture value');
            }
            return value;
        }
        return (
            Math.abs(
                required(
                    document.querySelector<NativeElement>(
                        '[data-height-engine="legacy"] [data-height-zone="short"]',
                    ),
                ).getBoundingClientRect().height - 42,
            ) < 1
        );
    });
    const heights = await page.evaluate(() =>
        [...document.querySelectorAll<NativeElement>('[data-height-engine]')].map((el) => ({
            engine: el.getAttribute('data-height-engine'),
            zones: [...el.querySelectorAll<NativeElement>('[data-height-zone]')].map((zone) => ({
                id: zone.getAttribute('data-height-zone'),
                height: zone.getBoundingClientRect().height,
                widget: zone
                    .querySelector<NativeElement>('[data-widget-id]')
                    ?.getBoundingClientRect()
                    .toJSON(),
            })),
        })),
    );
    heights.forEach(({zones}) => {
        near(zones[0].height, 42);
        near(zones[1].height, 0);
    });
    near(heights[0].zones[0].widget.width, heights[1].zones[0].widget.width);
    near(heights[0].zones[0].widget.height, heights[1].zones[0].widget.height);
    evidence.push({
        check: 'legacy/new native short and empty zone heights match with independent gap/padding and maxRows100',
        heights,
    });
});

// Critical: yes. Native touchscreen edits must commit one unscaled transaction.
test.describe('native touchscreen', () => {
    test.skip(
        ({browserName}) => browserName !== 'chromium',
        'Input.dispatchTouchEvent requires Chromium CDP',
    );
    test.use({hasTouch: true});
    test('native touchscreen drag', async ({page, evidence}) => {
        await page.goto(storyUrl('tests-gridstack--report-canvas'));
        await page.locator('[data-widget-id="a"]').waitFor();
        const touchRect = await page.locator('[data-widget-id="a"]').boundingBox();
        const touchIdentity = await page
            .locator('[data-widget-id="a"]')
            .getAttribute('data-widget-instance');
        const touchBefore = JSON.parse(
            checked(await page.locator('[data-qa="saved-config"]').textContent()),
        ) as Config;
        const touchDelta = {x: 45, y: 35};
        const session = await page.context().newCDPSession(page);
        const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', dx = 0, dy = 0) =>
            session.send('Input.dispatchTouchEvent', {
                type,
                touchPoints:
                    type === 'touchEnd'
                        ? []
                        : [{x: checked(touchRect).x + 30 + dx, y: checked(touchRect).y + 60 + dy}],
            });
        await touch('touchStart', 0, 0);
        await touch('touchMove', 5, 5);
        for (let count = 1; count <= 8; count++) {
            await touch(
                'touchMove',
                5 + ((touchDelta.x - 5) * count) / 8,
                5 + ((touchDelta.y - 5) * count) / 8,
            );
        }
        await touch('touchEnd');
        await page.waitForFunction(() => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            return (
                required(
                    required(document.querySelector<NativeElement>('[data-qa="event-count"]'))
                        .textContent,
                ) === 'Events: 1'
            );
        });
        const touchConfig = JSON.parse(
            checked(await page.locator('[data-qa="saved-config"]').textContent()),
        ) as Config;
        assert.equal(touchConfig.layout[0].x, touchBefore.layout[0].x + touchDelta.x);
        assert.equal(touchConfig.layout[0].y, touchBefore.layout[0].y + touchDelta.y);
        assert.equal(
            await page.locator('[data-widget-id="a"]').getAttribute('data-widget-instance'),
            touchIdentity,
        );
        evidence.push({
            check: 'browser-native touchscreen drag commits unscaled geometry once and retains plugin identity',
            config: touchConfig,
        });
    });
});
