import assert from 'node:assert/strict';

import type {Config} from '../../src/shared';

import {boundary, strictLifecycle} from './boundary-utils';
import {checked, storyUrl as fixtureUrl, test} from './fixtures';

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
    });
}
