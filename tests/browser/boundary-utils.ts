import assert from 'node:assert/strict';

import type {Page} from '@playwright/test';

import type {Config} from '../../src/shared';

import {checked, storyUrl} from './fixtures';
import type {NativeElement} from './types';

type ItemMeta = {id: string; identity: string};
// Critical: yes. Native edits must preserve saved geometry and a usable editor.
export function boundary(page: Page) {
    const frames = () =>
        page.evaluate(
            () =>
                new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                ),
        );
    const snapshot = () =>
        page.evaluate(() => {
            function required<T>(value: T | null | undefined): T {
                if (value === null || value === undefined) {
                    throw new Error('Missing native fixture value');
                }
                return value;
            }
            return {
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
                        transform: el.closest<HTMLElement>('.dashkit-gridstack__host')?.style
                            .transform,
                        rect: el.getBoundingClientRect().toJSON(),
                    }),
                ),
                containers: [
                    ...document.querySelectorAll<NativeElement>('.dashkit-gridstack__container'),
                ].map((el) => ({
                    id: required(el.parentElement).dataset.dashkitId,
                    transform: required(el.parentElement).style.transform,
                    rect: el.getBoundingClientRect().toJSON(),
                })),
            };
        });
    const sameRects = (
        actual: Awaited<ReturnType<typeof snapshot>>,
        expected: Awaited<ReturnType<typeof snapshot>>,
    ) => {
        for (const key of ['widgets', 'containers'] as const) {
            for (const entry of expected[key]) {
                const next = actual[key].find(({id}) => id === entry.id);
                assert(next, `missing ${entry.id}`);
                for (const field of ['x', 'y', 'width', 'height'] as const) {
                    assert(
                        Math.abs(next.rect[field] - entry.rect[field]) < 0.01,
                        `${entry.id} ${field}: ${next.rect[field]} != ${entry.rect[field]}`,
                    );
                }
            }
        }
    };
    const dragTo = async (
        rect: {
            x: number;
            y: number;
            width: number;
            height: number;
            bottom: number;
        },
        destination: {
            x: number;
            y: number;
        },
    ) => {
        const x = rect.x + rect.width / 2,
            y = rect.bottom - 12;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 5, y + 5);
        await page.mouse.move(destination.x, destination.y, {steps: 16});
        const preview = await page.locator('[data-dashkit-id]').evaluateAll((elements) =>
            Object.fromEntries(
                elements.map((el) => {
                    const node = (el as NativeElement).gridstackNode;
                    return [
                        (el as HTMLElement).dataset.dashkitId,
                        {x: node.x, y: node.y, w: node.w, h: node.h},
                    ];
                }),
            ),
        );
        await page.mouse.up();
        await frames();
        return preview;
    };
    return {frames, snapshot, sameRects, dragTo};
}

export async function strictLifecycle(page: Page, legacy = false) {
    const {snapshot} = boundary(page);
    await page.setViewportSize({width: 1000, height: 1000});
    await page.goto(storyUrl('tests-gridstack--strict-lifecycle', {legacy}));
    await page.locator('[data-widget-id="a"]').waitFor();
    await page.getByRole('button', {name: 'Read refs', exact: true}).click();
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
                    required(document.querySelector<NativeElement>('[data-qa="meta"]')).textContent,
                ),
            ).length === 2
        );
    });
    const strictMeta = JSON.parse(checked(await page.locator('[data-qa="meta"]').textContent()));
    const strictBefore = await snapshot();
    const oldHost = await page
        .locator(
            '[data-dashkit-id="a"], [data-dashkit-engine="legacy"] [data-qa="dashkit-grid-item"]:has([data-widget-id="a"])',
        )
        .elementHandle();
    const oldRoot = await page.locator('.grid-stack, .react-grid-layout').first().elementHandle();
    await page.getByRole('button', {name: 'Reverse layers', exact: true}).click();
    await page.getByRole('button', {name: 'Read refs', exact: true}).click();
    assert.deepEqual(
        JSON.parse(checked(await page.locator('[data-qa="meta"]').textContent())),
        [...strictMeta].reverse(),
    );
    await page.getByRole('button', {name: 'Toggle mount', exact: true}).click();
    assert.equal(await page.locator('[data-dashkit-engine]').count(), 0);
    await page.getByRole('button', {name: 'Toggle mount', exact: true}).click();
    await page.locator('[data-widget-id="a"]').waitFor();
    const strictAfter = await snapshot();
    await page.getByRole('button', {name: 'Read refs', exact: true}).click();
    await page.waitForFunction((widgets) => {
        function required<T>(value: T | null | undefined): T {
            if (value === null || value === undefined) {
                throw new Error('Missing native fixture value');
            }
            return value;
        }
        const metadata = JSON.parse(
            required(
                required(document.querySelector<NativeElement>('[data-qa="meta"]')).textContent,
            ),
        ) as ItemMeta[];
        return (
            metadata.length === 2 &&
            widgets.every(({id, instance}) =>
                metadata.some((item) => item.id === id && item.identity === instance),
            )
        );
    }, strictAfter.widgets);
    const metadata = JSON.parse(
        checked(await page.locator('[data-qa="meta"]').textContent()),
    ) as ItemMeta[];
    assert.deepEqual(
        Object.fromEntries(metadata.map(({id, identity}) => [id, identity])),
        Object.fromEntries(strictAfter.widgets.map(({id, instance}) => [id, instance])),
    );
    assert.equal(await page.locator('[data-widget-id="a"]').count(), 1);
    assert.equal(await page.locator('[data-widget-id="b"]').count(), 1);
    assert.notEqual(
        checked(strictAfter.widgets.find(({id}) => id === 'a')).instance,
        checked(strictBefore.widgets.find(({id}) => id === 'a')).instance,
    );
    assert.equal(strictAfter.events, 'Events: 0');

    return {strictBefore, strictMeta, strictAfter, oldRoot, oldHost};
}
