import assert from 'node:assert/strict';

import {canvas, crossZone, near} from './canvas-utils';
import {checked, storyUrl as fixtureUrl, test} from './fixtures';
import type {NativeElement} from './types';

for (const legacy of [false, true]) {
    test.describe(legacy ? 'legacy' : 'gridstack', () => {
        const storyUrl = (id: string) => fixtureUrl(id, {legacy});
        test('common overlapping drag and controlled restore preserve identity', async ({
            page,
            evidence,
        }) => {
            const {state, reset, drag, widget, layout} = canvas(page, legacy);
            const before = await reset();
            const rect = checked(widget(before, 'a')).rect;
            const overlapDelta = {x: 45, y: 35};
            await drag(rect.x + 30, rect.y + 60, overlapDelta.x, overlapDelta.y);
            let after = await state();
            assert.equal(
                checked(layout(after, 'a')).x,
                checked(layout(before, 'a')).x + overlapDelta.x,
            );
            assert.equal(
                checked(layout(after, 'a')).y,
                checked(layout(before, 'a')).y + overlapDelta.y,
            );
            assert.deepEqual(layout(after, 'b'), layout(before, 'b'));
            assert.equal(
                checked(widget(after, 'a')).instance,
                checked(widget(before, 'a')).instance,
            );
            assert.equal(after.events, 'Events: 1');
            evidence.push({
                check: 'common overlapping drag, one event, stable instances',
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
            const {state, reset, widget} = canvas(page, legacy);
            const before = await reset();
            const hit = () =>
                page.evaluate(() =>
                    document
                        .elementFromPoint(150, 150)
                        ?.closest('[data-dashkit-id], [data-qa="dashkit-grid-item"]')
                        ?.querySelector('[data-widget-id]')
                        ?.getAttribute('data-widget-id'),
                );
            assert.equal(await hit(), 'b');
            await page.getByRole('button', {name: 'Reverse layers', exact: true}).click();
            assert.equal(await hit(), 'a');
            const after = await state();
            assert.equal(
                checked(widget(after, 'a')).instance,
                checked(widget(before, 'a')).instance,
            );
            assert.equal(
                checked(widget(after, 'b')).instance,
                checked(widget(before, 'b')).instance,
            );
            assert.equal(after.events, before.events);
            evidence.push({
                check: 'controlled item order changes overlap hit testing without remount',
                after,
            });
        });

        for (const corner of ['nw', 'ne', 'sw', 'se']) {
            test(`common ${corner} corner resize anchors the opposite corner`, async ({
                page,
                evidence,
            }) => {
                const {state, reset, drag, widget, layout} = canvas(page, legacy);
                const before = await reset();
                const handle = await page
                    .locator(
                        `:is([data-dashkit-id="b"], [data-qa="dashkit-grid-item"]:has([data-widget-id="b"])) :is(.ui-resizable-${corner}, .react-resizable-handle-${corner})`,
                    )
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
                assert.equal(
                    checked(widget(after, 'b')).instance,
                    checked(widget(before, 'b')).instance,
                );
                assert.equal(after.events, 'Events: 1');
                evidence.push({
                    check: `common ${corner} corner, anchored opposite corner and saved size`,
                    before,
                    after,
                });
            });
        }

        test('half-scale drag and resize preserve unscaled geometry', async ({page, evidence}) => {
            const {state, reset, drag, widget, layout} = canvas(page, legacy);
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
                check: 'common CSS scale 0.5 drag converts screen delta into pixel units',
                before,
                after,
            });
            const scaledHandle = await page
                .locator(
                    ':is([data-dashkit-id="b"], [data-qa="dashkit-grid-item"]:has([data-widget-id="b"])) :is(.ui-resizable-se, .react-resizable-handle-se)',
                )
                .boundingBox();
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
                check: 'common scaled corner resize keeps opposite corner anchored in unscaled units',
                after,
            });
        });

        for (const [kind, scaleStory] of [
            ['scalar', storyUrl('tests-gridstack--scalar-zoom')],
            ['ref', storyUrl('tests-gridstack--report-canvas')],
        ]) {
            test(`common ${kind} scale2 drag preserves geometry and identity`, async ({
                page,
                evidence,
            }) => {
                const {state, drag, widget, layout} = canvas(page, legacy);
                await page.setViewportSize({width: 1800, height: 1200});
                const scale = 2;
                const scaledDelta = {x: 90, y: 70};
                await page.goto(scaleStory);
                await page.locator('[data-widget-id="a"]').waitFor();
                const renderCount = await page
                    .locator('[data-widget-id="a"]')
                    .getAttribute('data-widget-renders');
                await page
                    .getByRole('button', {name: kind === 'scalar' ? 'Zoom2' : 'Ref2', exact: true})
                    .click();
                if (kind === 'ref') {
                    assert.equal(
                        await page
                            .locator('[data-widget-id="a"]')
                            .getAttribute('data-widget-renders'),
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
                assert.equal(
                    checked(widget(after, 'a')).instance,
                    checked(widget(before, 'a')).instance,
                );
                evidence.push({
                    check:
                        kind === 'scalar'
                            ? 'common scalar scale2 drag preserves unscaled delta and identity'
                            : 'mutable scaleRef changed without React rerender drives native scale2 drag',
                    before,
                    after,
                });
            });
        }

        for (const edge of ['n', 's', 'e', 'w'] as const) {
            test(`common ${edge} edge resize anchors the opposite edge`, async ({
                page,
                evidence,
            }) => {
                const {state, drag, widget, layout} = canvas(page, legacy);
                await page.setViewportSize({width: 1000, height: 1000});
                await page.goto(storyUrl('tests-gridstack--all-handles'));
                await page.locator('[data-widget-id="b"]').waitFor();
                const before = await state();
                const handle = await page
                    .locator(
                        `:is([data-dashkit-id="b"], [data-qa="dashkit-grid-item"]:has([data-widget-id="b"])) :is(.ui-resizable-${edge}, .react-resizable-handle-${edge})`,
                    )
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
                    near(
                        edge === 'n' ? next.bottom : next.top,
                        edge === 'n' ? old.bottom : old.top,
                    );
                } else {
                    assert.equal(checked(layout(after, 'b')).w, 205);
                    assert.equal(checked(layout(after, 'b')).h, 120);
                    near(next.top, old.top);
                    near(
                        edge === 'w' ? next.right : next.left,
                        edge === 'w' ? old.right : old.left,
                    );
                }
                assert.deepEqual(layout(after, 'a'), layout(before, 'a'));
                evidence.push({
                    check: `common ${edge.toUpperCase()} edge resize anchors opposite edge and preserves neighbor`,
                    before,
                    after,
                });
            });
        }

        test('common drag clamps to right and bottom bounds', async ({page, evidence}) => {
            const {state, reset, drag, widget, layout} = canvas(page, legacy);
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
                check: 'common drag clamps to fixed right and bottom bounds',
                before,
                after,
            });
        });

        test('common drag clamps to left and top bounds', async ({page, evidence}) => {
            const {state, reset, drag, widget, layout} = canvas(page, legacy);
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
                check: 'common drag beyond left/top clamps to origin without disturbing overlap neighbor',
                before,
                after,
            });
        });

        test('common palette drop preserves existing widgets', async ({page, evidence}) => {
            const {state, reset} = canvas(page, legacy);
            const before = await reset();
            await page
                .getByRole('button', {name: '+ Widget', exact: true})
                .dragTo(page.locator('.grid-stack, .react-grid-layout').first(), {
                    targetPosition: {x: 450, y: 300},
                });
            const after = await state();
            assert.equal(after.config.items.length, 3);
            assert.equal(after.config.counter, 2);
            const added = after.config.layout.find(
                (entry) => !before.config.layout.some((old) => old.i === entry.i),
            );
            assert.deepEqual(
                {
                    x: checked(added).x,
                    y: checked(added).y,
                    w: checked(added).w,
                    h: checked(added).h,
                },
                {x: 450, y: 300, w: 100, h: 80},
            );
            assert.deepEqual(after.config.layout.slice(0, 2), before.config.layout);
            evidence.push({
                check: 'common HTML5 palette drop commits geometry and preserves existing widgets',
                before,
                after,
            });
        });

        test('focus, keyboard and visual autoheight survive editing', async ({page, evidence}) => {
            const {state, reset, drag, widget, layout} = canvas(page, legacy);
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
                    .locator(
                        '[data-dashkit-id="a"], .react-grid-layout > [data-qa="dashkit-grid-item"]:has([data-widget-id="a"])',
                    )
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
                check: 'common focus callbacks/stacking and keyboard tab, visual autoheight survives move and reset preserves saved height',
                after,
            });
        });

        // Critical: yes. Real pointer actions must retain the saved document and plugin identity.
        test('collision prevents displacement of the neighbor', async ({page, evidence}) => {
            const {state, drag, widget, layout} = canvas(page, legacy);
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
                check: 'common preventCollision stops before occupied rectangle without pushing its neighbor',
                before,
                after,
            });
        });

        test('horizontal nowrap resize consumes remaining width', async ({page, evidence}) => {
            const {state, drag, layout} = canvas(page, legacy);
            await page.goto(storyUrl('tests-gridstack--horizontal-nowrap'));
            await page.locator('[data-widget-id="b"]').waitFor();
            const before = await state();
            const resize = await page
                .locator(
                    ':is([data-dashkit-id="b"], [data-qa="dashkit-grid-item"]:has([data-widget-id="b"])) :is(.ui-resizable-se, .react-resizable-handle-se)',
                )
                .boundingBox();
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
                check: 'common horizontal-nowrap resize consumes remaining row width without wrapping or displacing neighbor',
                before,
                after,
            });
        });

        test('custom React handles retain plugin state', async ({page, evidence}) => {
            const {state, drag, widget, layout} = canvas(page, legacy);
            await page.goto(storyUrl('tests-gridstack--custom-handles'));
            await page.locator('[data-widget-id="b"]').waitFor();
            const before = await state();
            assert.equal(
                await page
                    .locator(
                        ':is([data-dashkit-id="b"], .react-grid-layout > [data-qa="dashkit-grid-item"]:has([data-widget-id="b"])) [data-custom-handle]',
                    )
                    .count(),
                4,
            );
            const resize = await page
                .locator(
                    ':is([data-dashkit-id="b"], .react-grid-layout > [data-qa="dashkit-grid-item"]:has([data-widget-id="b"])) [data-custom-handle="se"]',
                )
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
            assert.equal(
                checked(widget(after, 'b')).instance,
                checked(widget(before, 'b')).instance,
            );
            evidence.push({
                check: 'custom React corner handle drives native resize and retains plugin state',
                before,
                after,
            });
        });

        test('cross-zone transfer preserves geometry, constraints and callbacks', async ({
            page,
            evidence,
        }) => {
            const {before, after, callbacks} = await crossZone(page, legacy);
            const item = after.config.layout.find(({i}) => i === 'b');
            assert.equal(checked(item).parent, 'right');
            assert.deepEqual(after.config.layout[0], before.config.layout[0]);
            near(checked(item).x, 40);
            near(checked(item).y, 40);
            assert.equal(checked(item).w, 180);
            assert.equal(checked(item).h, 120);
            assert.equal(after.widgets[0].instance, before.widgets[0].instance);
            assert.equal(after.events, 'Events: 1');
            const start = callbacks.find(({phase}) => phase === 'start');
            const movement = callbacks.find(({phase}) => phase === 'move');
            const stops = callbacks.filter(({phase}) => phase === 'stop');
            assert.equal(checked(start).group, 'left');
            assert.equal(stops.length, 1);
            assert(callbacks.indexOf(checked(start)) < callbacks.indexOf(checked(movement)));
            assert(callbacks.indexOf(checked(movement)) < callbacks.indexOf(stops[0]));
            assert.equal(stops[0].group, 'left');
            assert.equal(stops[0].placeholder, null);
            assert.equal(checked(movement).old.minW, 20);
            assert.equal(checked(movement).next.minW, 20);
            assert.equal(checked(checked(movement).placeholder).placeholder, true);
            evidence.push({
                check: 'same cross-zone geometry, constraints, one save and source callbacks',
                before,
                after,
                callbacks,
            });
        });

        test('destination veto rejects a cross-group drop and the next transfer keeps constraints', async ({
            page,
            evidence,
        }) => {
            const {state, drag, widget} = canvas(page, legacy);
            await page.goto(fixtureUrl('tests-gridstack--cross-zones', {legacy, occupied: true}));
            await page.locator('[data-widget-id="c"]').waitFor();
            const before = await state();
            const destination = checked(
                await page.locator('.grid-stack, .react-grid-layout').nth(1).boundingBox(),
            );
            const move = async () => {
                const rect = checked(widget(await state(), 'b')).rect;
                await drag(
                    rect.x + rect.width / 2,
                    rect.y + rect.height / 2,
                    destination.x + 130 - rect.x - rect.width / 2,
                    destination.y + 100 - rect.y - rect.height / 2,
                );
            };
            await move();
            const rejected = await state();
            assert.equal(rejected.config.layout.find(({i}) => i === 'b')?.parent, 'left');
            assert.deepEqual(
                rejected.config.layout.find(({i}) => i === 'c'),
                before.config.layout.find(({i}) => i === 'c'),
            );
            assert.deepEqual(rejected.config.layout[0], before.config.layout[0]);
            assert.equal(rejected.events, 'Events: 1');
            const bounded = checked(widget(rejected, 'b')).rect;
            assert(
                bounded.right <= rejected.root.right + 1 &&
                    bounded.bottom <= rejected.root.bottom + 1,
            );
            await page
                .getByRole('button', {name: 'Remove destination blocker', exact: true})
                .click();
            await move();
            const accepted = await state();
            const item = checked(accepted.config.layout.find(({i}) => i === 'b'));
            assert.equal(item.parent, 'right');
            assert.equal(item.w, 100);
            assert.equal(item.h, 80);
            assert.equal(accepted.events, 'Events: 2');
            assert.deepEqual(accepted.config.layout[0], before.config.layout[0]);
            evidence.push({
                check: 'destination admission veto with occupied target, bounded source release and next admitted cross-group save',
                before,
                rejected,
                accepted,
            });
        });

        test('dashboard view/edit and passive resize converge', async ({page, evidence}) => {
            const {state, widget} = canvas(page, legacy);
            await page.goto(storyUrl('tests-gridstack--dashboard'));
            await page.locator('[data-widget-id="b"]').waitFor();
            const before = await state();
            for (let count = 0; count < 6; count++) {
                await page.getByRole('button', {name: 'Toggle edit', exact: true}).click();
            }
            let after = await state();
            assert.equal(after.events, 'Events: 0');
            assert.deepEqual(after.config, before.config);
            assert.equal(
                checked(widget(after, 'a')).instance,
                checked(widget(before, 'a')).instance,
            );
            assert.equal(
                checked(widget(after, 'b')).instance,
                checked(widget(before, 'b')).instance,
            );
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
                            document.querySelector<NativeElement>(
                                '.dashkit-gridstack__zone, .react-grid-layout',
                            ),
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
            assert.equal(
                checked(widget(after, 'a')).instance,
                checked(widget(before, 'a')).instance,
            );
            assert.equal(after.events, 'Events: 0');
            evidence.push({
                check: 'fluid dashboard width converges and passive resize preserves config and identity',
                widths,
                after,
            });
        });
    });
}
