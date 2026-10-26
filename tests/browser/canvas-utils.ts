import assert from 'node:assert/strict';

import type {Page} from '@playwright/test';

import type {Config} from '../../src/shared';

import {checked, storyUrl} from './fixtures';
import type {NativeElement} from './types';
export const near = (actual: number, expected: number) =>
    assert(Math.abs(actual - expected) <= 1, `${actual} != ${expected}`);
export function canvas(page: Page, legacy = false) {
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
                root: required(
                    document.querySelector<NativeElement>('.grid-stack, .react-grid-layout'),
                )
                    .getBoundingClientRect()
                    .toJSON(),
            };
        });
    const reset = async () => {
        await page.goto(storyUrl('tests-gridstack--report-canvas', {legacy}));
        await page.locator('[data-widget-id="b"]').waitFor();
        const result = await state();
        assert.equal(
            result.engine,
            legacy ? 'legacy' : 'gridstack',
            `requested legacy=${legacy}; mounted ${result.engine}`,
        );
        return result;
    };
    const drag = async (x: number, y: number, dx: number, dy: number, initialStep = 5) => {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + Math.sign(dx) * initialStep, y + Math.sign(dy) * initialStep);
        // Let controlled React layouts commit each motion before calculating the next delta.
        for (let step = 1; step <= 8; step++) {
            await page.mouse.move(x + (dx * step) / 8, y + (dy * step) / 8);
            await page.evaluate(
                () =>
                    new Promise<void>((resolve) =>
                        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                    ),
            );
        }
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

export async function crossZone(page: Page, legacy = false) {
    const {state, drag, widget} = canvas(page, legacy);
    const zonesURL = storyUrl('tests-gridstack--cross-zones', {legacy});
    await page.goto(zonesURL);
    await page.locator('[data-widget-id="b"]').waitFor();
    const before = await state();
    const destination = await page.locator('.grid-stack, .react-grid-layout').nth(1).boundingBox();
    const rect = checked(widget(before, 'b')).rect;
    await drag(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        checked(destination).x + 130 - rect.x - rect.width / 2,
        checked(destination).y + 100 - rect.y - rect.height / 2,
    );
    const after = await state();
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

    return {before, after, callbacks};
}
