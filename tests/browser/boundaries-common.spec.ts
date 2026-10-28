import assert from 'node:assert/strict';

import type {Config} from '../../src/shared';

import {boundary, strictLifecycle} from './boundary-utils';
import {checked, dropPalette, storyUrl as fixtureUrl, test} from './fixtures';

for (const legacy of [false, true]) {
    test.describe(legacy ? 'legacy' : 'gridstack', () => {
        const storyUrl = (id: string) => fixtureUrl(id, {legacy});
        test('StrictMode reorder, unmount and remount retain current refs', async ({
            page,
            evidence,
        }) => {
            const {strictBefore, strictMeta, strictAfter} = await strictLifecycle(page, legacy);
            evidence.push({
                check: 'shared StrictMode controlled ref order, remount and no echo',
                strictBefore,
                strictMeta,
                strictAfter,
            });
        });
        test('hidden finite canvas reveals without remount and accepts the next resize', async ({
            page,
            evidence,
        }) => {
            const {frames, snapshot} = boundary(page);
            await page.goto(storyUrl('tests-gridstack--finite-nowrap'));
            await page.locator('[data-widget-id="a"]').waitFor();
            await page.getByRole('button', {name: 'Remove b', exact: true}).click();
            await frames();
            const visible = await snapshot();
            const content = await page
                .locator('[data-widget-id="a"]')
                .getAttribute('data-widget-renders');
            await page.locator('[data-widget-id="a"]').evaluate((el) => {
                (
                    window as Window & {
                        __boundaryWidget?: Element;
                    }
                ).__boundaryWidget = el;
            });
            await page.locator('[data-qa="contract-canvas"]').evaluate((el) => {
                el.style.setProperty('display', 'none');
            });
            await frames();
            await frames();
            await page.locator('[data-qa="contract-canvas"]').evaluate((el) => {
                el.style.removeProperty('display');
            });
            await frames();
            await frames();
            const revealed = await snapshot();
            assert.deepEqual(revealed.config, visible.config);
            assert.equal(revealed.events, visible.events);
            assert.equal(
                await page.locator('[data-widget-id="a"]').evaluate(
                    (el) =>
                        el ===
                        (
                            window as Window & {
                                __boundaryWidget?: Element;
                            }
                        ).__boundaryWidget,
                ),
                true,
            );
            if (!legacy) {
                assert.equal(
                    await page.locator('[data-widget-id="a"]').getAttribute('data-widget-renders'),
                    content,
                );
            }
            assert.equal(revealed.widgets[0].rect.width, visible.widgets[0].rect.width);
            evidence.push({
                check: 'zero-width hidden to visible retains content node, config and no echo; native content does not rerender',
                visible,
                revealed,
            });
            const a = checked(revealed.widgets.find(({id}) => id === 'a')).rect;
            const handle = await page
                .locator(
                    ':is([data-dashkit-id="a"], [data-qa="dashkit-grid-item"]:has([data-widget-id="a"])) :is(.ui-resizable-se, .react-resizable-handle-se)',
                )
                .boundingBox();
            const hx = checked(handle).x + checked(handle).width / 2,
                hy = checked(handle).y + checked(handle).height / 2;
            await page.mouse.move(hx, hy);
            await page.mouse.down();
            await page.mouse.move(hx + 5, hy);
            await page.mouse.move(hx + 54, hy, {steps: 8});
            await page.mouse.up();
            await frames();
            const afterRevealDrag = await snapshot();
            assert.equal(afterRevealDrag.events, 'Events: 1');
            assert.equal(afterRevealDrag.config.layout[0].w, 9);
            assert.equal(afterRevealDrag.widgets[0].rect.width - a.width, 54);
            evidence.push({
                check: 'first native gesture after zero-width reveal uses settled geometry',
                afterRevealDrag,
            });
        });

        test('horizontal packing matches legacy public reflow', async ({page, evidence}) => {
            const {frames, snapshot} = boundary(page);
            await page.goto(storyUrl('tests-gridstack--horizontal-packing'));
            await page.locator('[data-widget-id="b"]').waitFor();
            const golden = JSON.parse(
                checked(await page.locator('[data-qa="legacy-reflow"]').textContent()),
            ) as Config['layout'];
            await page.getByRole('button', {name: 'Compact', exact: true}).click();
            await frames();
            const horizontal = await snapshot();
            assert.deepEqual(horizontal.config.layout, golden);
            const packedA = horizontal.config.layout.find(({i}) => i === 'a');
            const packedB = horizontal.config.layout.find(({i}) => i === 'b');
            assert.equal(Math.max(checked(packedA).y, checked(packedB).y), 2);
            const upper = checked(
                horizontal.widgets.find(
                    ({id}) => id === (checked(packedA).y < checked(packedB).y ? 'a' : 'b'),
                ),
            ).rect;
            const lower = checked(
                horizontal.widgets.find(
                    ({id}) => id === (checked(packedA).y < checked(packedB).y ? 'b' : 'a'),
                ),
            ).rect;
            assert(lower.top >= upper.bottom + 6);
            evidence.push({
                check: 'native horizontal gaps and overflow row-wrap match actual legacy public reflow exactly',
                golden,
                horizontal,
            });
        });

        for (const paletteY of legacy ? [5] : [5, 30]) {
            test(`finite nowrap rejects unavailable palette space and commits valid drops at row pointer ${paletteY}`, async ({
                page,
                evidence,
            }) => {
                const {frames, snapshot} = boundary(page);
                await page.goto(storyUrl('tests-gridstack--finite-nowrap'));
                await page.locator('[data-widget-id="b"]').waitFor();
                const full = await snapshot();
                const fullHandle = await page
                    .locator(
                        ':is([data-dashkit-id="a"], [data-qa="dashkit-grid-item"]:has([data-widget-id="a"])) :is(.ui-resizable-se, .react-resizable-handle-se)',
                    )
                    .boundingBox();
                const fx = checked(fullHandle).x + checked(fullHandle).width / 2,
                    fy = checked(fullHandle).y + checked(fullHandle).height / 2;
                await page.mouse.move(fx, fy);
                await page.mouse.down();
                await page.mouse.move(fx + 5, fy);
                await page.mouse.move(fx + 108, fy, {steps: 8});
                await page.mouse.up();
                await frames();
                assert.deepEqual((await snapshot()).config, full.config);
                assert.equal((await snapshot()).events, full.events);
                await page
                    .getByRole('button', {name: '+ Widget', exact: true})
                    .dragTo(page.locator('.grid-stack, .react-grid-layout').first(), {
                        targetPosition: {x: 450, y: paletteY},
                    });
                const noSpace = await snapshot();
                assert.deepEqual(noSpace.config, full.config);
                assert.equal(noSpace.events, full.events);
                assert.equal(
                    await page
                        .locator('[data-dashkit-id="__dropping-elem__"], .react-grid-item.dropping')
                        .count(),
                    0,
                );
                await page.getByRole('button', {name: 'Remove b', exact: true}).click();
                await frames();
                await page
                    .getByRole('button', {name: 'Palette allowed: true', exact: true})
                    .click();
                const available = await snapshot();
                await page
                    .getByRole('button', {name: '+ Widget', exact: true})
                    .dragTo(page.locator('.grid-stack, .react-grid-layout').first(), {
                        targetPosition: {x: 450, y: paletteY},
                    });
                assert.deepEqual((await snapshot()).config, available.config);
                assert.equal(
                    await page
                        .locator('[data-dashkit-id="__dropping-elem__"], .react-grid-item.dropping')
                        .count(),
                    0,
                );
                await page
                    .getByRole('button', {name: 'Palette allowed: false', exact: true})
                    .click();
                const source = await page
                    .getByRole('button', {name: '+ Widget', exact: true})
                    .boundingBox();
                const root = await page
                    .locator('.grid-stack, .react-grid-layout')
                    .first()
                    .boundingBox();
                await page.mouse.move(
                    checked(source).x + checked(source).width / 2,
                    checked(source).y + checked(source).height / 2,
                );
                await page.mouse.down();
                await page.mouse.move(checked(root).x + 450, checked(root).y + paletteY, {
                    steps: 12,
                });
                await page.mouse.move(checked(root).x + 460, checked(root).y + paletteY);
                await frames();
                await page
                    .locator('[data-dashkit-id="__dropping-elem__"], .react-grid-item.dropping')
                    .waitFor({state: 'visible'});
                assert.equal(
                    await page
                        .locator('[data-dashkit-id="__dropping-elem__"], .react-grid-item.dropping')
                        .count(),
                    1,
                );
                await page.mouse.move(850, 650, {steps: 8});
                await page.mouse.up();
                await frames();
                assert.equal(
                    await page
                        .locator('[data-dashkit-id="__dropping-elem__"], .react-grid-item.dropping')
                        .count(),
                    0,
                );
                assert.deepEqual((await snapshot()).config, available.config);
                await dropPalette(
                    page,
                    page.getByRole('button', {name: '+ Widget', exact: true}),
                    page.locator('.grid-stack, .react-grid-layout').first(),
                    {x: 450, y: paletteY},
                );
                const committed = await snapshot();
                assert.equal(committed.config.items.length, 2);
                assert.equal(committed.events, 'Events: 0');
                assert.equal(await page.locator('[data-qa="drop-count"]').textContent(), '1');
                assert.equal(
                    committed.config.layout.reduce((sum, entry) => sum + entry.w, 0),
                    12,
                );
                assert(committed.config.layout.every(({y, h}) => y === 0 && h === 2));
                assert.equal(
                    await page
                        .locator('[data-dashkit-id="__dropping-elem__"], .react-grid-item.dropping')
                        .count(),
                    0,
                );
                evidence.push({
                    check: 'finite nowrap native no-space drop, validator false, canceled preview cleanup then valid commit consumes only remaining width',
                    full,
                    noSpace,
                    available,
                    committed,
                });
            });
        }
    });
}
