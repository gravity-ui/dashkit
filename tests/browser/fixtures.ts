import assert from 'node:assert/strict';

import {test as base, expect} from '@playwright/test';

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

export function storyUrl(story: string, args: Record<string, string | boolean | null> = {}) {
    const search = new URLSearchParams({id: `tests-gridstack--${story}`, viewMode: 'story'});
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
