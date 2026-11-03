import assert from 'node:assert/strict';

import {test as base, expect} from '@playwright/test';
import type {Locator, Page} from '@playwright/test';

export const test = base.extend<{evidence: unknown[]}>({
    evidence: async ({page}, provide, testInfo) => {
        const evidence: unknown[] = [];
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        await provide(evidence);
        await testInfo.attach('native-contracts', {
            body: JSON.stringify(evidence, null, 2),
            contentType: 'application/json',
        });
        expect(errors, 'uncaught browser errors').toEqual([]);
    },
});

export async function dropPalette(
    page: Page,
    source: Locator,
    target: Locator,
    position: {x: number; y: number},
) {
    if (page.context().browser()?.browserType().name() !== 'webkit') {
        await source.dragTo(target, {targetPosition: position});
        return;
    }
    const from = checked(await source.boundingBox());
    const to = checked(await target.boundingBox());
    const x = from.x + from.width / 2;
    const y = from.y + from.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 10, y, {steps: 3});
    // WebKit needs a second target move to deliver dragover after dragenter.
    await page.mouse.move(to.x + position.x, to.y + position.y);
    await page.mouse.move(to.x + position.x, to.y + position.y);
    await target
        .locator('[data-dashkit-id="__dropping-elem__"], .react-grid-item.dropping')
        .waitFor();
    await page.mouse.up();
}

export function storyUrl(story: string, args: Record<string, string | boolean | null> = {}) {
    const search = new URLSearchParams({
        id: story.includes('--') ? story : `tests-layout-contract--${story}`,
        viewMode: 'story',
    });
    if (Object.keys(args).length) {
        search.set(
            'args',
            Object.entries(args)
                .map(([key, value]) => `${key}:${value === null ? '!null' : value}`)
                .join(';'),
        );
    }
    return `/iframe.html?${search}`;
}

export function checked<T>(value: T | null | undefined): T {
    assert(value !== null && value !== undefined, 'Missing native fixture value');
    return value;
}
