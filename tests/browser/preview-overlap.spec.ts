import assert from 'node:assert/strict';

import type {Config} from '../../src/shared';

import {checked, storyUrl as fixtureUrl, test} from './fixtures';
import type {NativeElement} from './types';
// Critical: yes. Native edits must preserve saved geometry and a usable editor.
for (const {legacy, nested, initialCompactType} of [
    {legacy: false, nested: false, initialCompactType: null},
    {legacy: false, nested: true, initialCompactType: null},
    {legacy: false, nested: false, initialCompactType: 'vertical'},
    {legacy: true, nested: false, initialCompactType: 'vertical'},
]) {
    test(`${legacy ? 'legacy' : 'gridstack'} ${nested ? 'nested' : 'flat'} ${initialCompactType} palette cancellation and overlap matrix`, async ({
        page,
        evidence,
    }) => {
        const storyUrl = (id: string, args: Record<string, string | boolean | null>) =>
            fixtureUrl(id, {compactType: initialCompactType, ...args, legacy});
        const saved = () =>
            page
                .locator('[data-qa="preview-overlap-config"]')
                .textContent()
                .then((text) => JSON.parse(checked(text)) as Config);
        const host = (id: string) =>
            page.locator(
                `[data-dashkit-id="${id}"], [data-dashkit-engine="legacy"] .react-grid-layout > .react-grid-item:has([data-contract-widget="${id}"])`,
            );
        const position = (id: string) =>
            host(id).evaluate((el) => {
                const rect = el.getBoundingClientRect();
                const root = checkedRoot(
                    el.closest('.grid-stack, .react-grid-layout'),
                ).getBoundingClientRect();
                function checkedRoot(value: Element | null) {
                    if (!value) {
                        throw new Error('Missing preview grid');
                    }
                    return value;
                }
                return {
                    x: (rect.x - root.x) / 50,
                    y: (rect.y - root.y) / 40,
                    w: rect.width / 50,
                    h: rect.height / 40,
                };
            });
        const drag = async (id: string, dx: number, dy: number) => {
            const rect = await host(id).boundingBox();
            const x = checked(rect).x + checked(rect).width / 2;
            const y = checked(rect).y + checked(rect).height / 2;
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + Math.sign(dx) * 5, y + Math.sign(dy) * 5);
            for (let step = 1; step <= 12; step++) {
                await page.mouse.move(x + (dx * step) / 12, y + (dy * step) / 12);
                await page.evaluate(
                    () =>
                        new Promise<void>((resolve) =>
                            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                        ),
                );
            }
            await page.mouse.up();
        };

        await page.goto(storyUrl('tests-gridstack--preview-overlap', {nested}));
        await host('b').waitFor();
        const before = await saved();
        const palette = await page.getByRole('button', {name: '+ Add', exact: true}).boundingBox();
        const root = nested
            ? page.locator('[data-dashkit-id="box"] .grid-stack')
            : page.locator('.grid-stack, .react-grid-layout').first();
        const bounds = await root.boundingBox();
        await page.mouse.move(
            checked(palette).x + checked(palette).width / 2,
            checked(palette).y + checked(palette).height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
            checked(palette).x + checked(palette).width / 2 + 10,
            checked(palette).y + checked(palette).height / 2,
            {
                steps: 3,
            },
        );
        await page.mouse.move(checked(bounds).x - 10, checked(bounds).y - 10, {steps: 12});
        // Enter an uncovered part of the grid before crossing a widget (RGL's Firefox target guard).
        await page.mouse.move(checked(bounds).x + 250, checked(bounds).y + 5);
        await page.mouse.move(checked(bounds).x + 5, checked(bounds).y + 5);
        await page.mouse.move(checked(bounds).x + 6, checked(bounds).y + 6);
        await page.waitForFunction(() =>
            document.querySelector<NativeElement>(
                '[data-dashkit-id="__dropping-elem__"], .react-grid-item.dropping',
            ),
        );
        const collided = await position('a');
        if (!legacy) {
            assert.equal(collided.y, 2, 'native preview must really displace the neighbor');
        }
        assert.deepEqual(await saved(), before, 'preview is not a save');
        // Leaving cancels the preview before the palette source clears its drag context.
        await page.mouse.move(
            checked(bounds).x + checked(bounds).width + 40,
            checked(bounds).y + checked(bounds).height + 10,
            {
                steps: 6,
            },
        );
        await page.waitForFunction(
            () =>
                !document.querySelector<NativeElement>(
                    '[data-dashkit-id="__dropping-elem__"], .react-grid-item.dropping',
                ),
        );
        assert.deepEqual(await position('a'), {x: 0, y: 0, w: 4, h: 2});
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await page.waitForFunction(
            () =>
                !document.querySelector<NativeElement>(
                    '[data-dashkit-id="__dropping-elem__"], .react-grid-item.dropping',
                ),
        );
        assert.deepEqual(await position('a'), {x: 0, y: 0, w: 4, h: 2});
        assert.deepEqual(await saved(), before);
        await drag('b', -50, 0);
        await page.waitForFunction(() => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            return (
                JSON.parse(
                    required(
                        required(
                            document.querySelector<NativeElement>(
                                '[data-qa="preview-overlap-config"]',
                            ),
                        ).textContent,
                    ),
                ).layout[1].x === 7
            );
        });
        const after = await saved();
        assert.deepEqual(after.layout[0], before.layout[0]);
        assert.equal(after.layout[1].x, 7);
        evidence.push({
            check: 'native preview collision, leave/Escape cancellation, later save',
            nested,
            before,
            collided,
            after,
        });
        // A successful add keeps the collision-adjusted neighbors and the selected position.
        await page.goto(storyUrl('tests-gridstack--preview-overlap', {nested}));
        await host('b').waitFor();
        await page
            .getByRole('button', {name: '+ Add', exact: true})
            .dragTo(root, {targetPosition: {x: initialCompactType === null ? 5 : 250, y: 5}});
        await host('added').waitFor();
        const placed = await saved();
        const added = checked(placed.layout.find(({i}) => i === 'added'));
        assert.equal(added.w, 3);
        assert.equal(added.h, 2);
        assert(
            placed.layout
                .filter(({i}) => i !== 'added')
                .every(
                    (entry) =>
                        !(
                            entry.x < added.x + added.w &&
                            added.x < entry.x + entry.w &&
                            entry.y < added.y + added.h &&
                            added.y < entry.y + entry.h
                        ),
                ),
        );
        if (!legacy && initialCompactType === null) {
            assert.equal(checked(placed.layout.find(({i}) => i === 'a')).y, 2);
            assert.deepEqual(await position('added'), {x: 0, y: 0, w: 3, h: 2});
        }
        assert.equal(await page.locator('[data-qa="preview-overlap-drops"]').textContent(), '1');
        evidence.push({
            check: 'successful palette collision keeps placement and displaced layout',
            nested,
            placed,
        });
        for (const compactType of [null, 'vertical', 'horizontal', 'horizontal-nowrap']) {
            for (const allowOverlap of [true, false]) {
                await page.goto(
                    storyUrl('tests-gridstack--preview-overlap', {
                        nested,
                        compactType,
                        allowOverlap,
                    }),
                );
                await host('b').waitFor();
                if (!legacy) {
                    const mode = await host('b').evaluate(
                        (el) => (el as NativeElement).gridstackNode.grid.engine.mode,
                    );
                    assert.equal(mode.compactType, compactType);
                    assert.equal(mode.allowOverlap, allowOverlap);
                }
                const dy = compactType === 'horizontal-nowrap' ? 0 : 40;
                if (
                    initialCompactType === 'vertical' &&
                    !allowOverlap &&
                    compactType?.startsWith('horizontal')
                ) {
                    await drag('a', 300, dy);
                } else {
                    await drag('b', -300, dy);
                }
                await page.waitForFunction(() => {
                    function required<T>(value: T | null | undefined): T {
                        if (value === null || value === undefined) {
                            throw new Error('Missing native fixture value');
                        }
                        return value;
                    }
                    return (
                        JSON.parse(
                            required(
                                required(
                                    document.querySelector<NativeElement>(
                                        '[data-qa="preview-overlap-config"]',
                                    ),
                                ).textContent,
                            ),
                        ).layout[1].x !== 8
                    );
                });
                const afterMove = await saved();
                const a = afterMove.layout[0];
                const b = afterMove.layout[1];
                if (allowOverlap) {
                    assert.equal(b.x, 2);
                    assert.equal(b.y, compactType === 'horizontal-nowrap' ? 0 : 1);
                    assert.deepEqual(a, {...a, x: 0, y: 0});
                    assert.deepEqual(await position('b'), {x: b.x, y: b.y, w: 3, h: 2});
                } else {
                    assert(
                        !(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h),
                    );
                }
                evidence.push({
                    check: 'native overlap gesture saved exact engine position',
                    nested,
                    compactType,
                    allowOverlap,
                    afterMove,
                });
            }
        }
    });
}
