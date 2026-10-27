import assert from 'node:assert/strict';

import {boundary} from './boundary-utils';
import {checked, storyUrl, test} from './fixtures';
import type {NativeElement} from './types';

// Critical: yes. Admission and preview must use same converted size in a bounded occupied grid.
test('native cross-grid pointer transfer keeps converted size through both fit checks', async ({
    page,
    evidence,
}) => {
    const {snapshot, dragTo, frames} = boundary(page);
    await page.goto(storyUrl('tests-gridstack--converted-fit'));
    await page.locator('[data-widget-id="a"]').waitFor();
    const before = await snapshot();
    const target = checked(await page.locator('[data-fit-zone="right"] .grid-stack').boundingBox());
    const source = checked(await page.locator('[data-fit-zone="left"] .grid-stack').boundingBox());
    const origin = checked(before.widgets.find(({id}) => id === 'a')).rect;
    const preview = await dragTo(origin, {x: target.x + 120, y: target.y + 35});
    assert.equal(preview.a.w, 10);
    assert.equal(preview.a.h, 4);
    const after = await snapshot();
    assert.equal(after.events, 'Events: 1');
    assert.equal(checked(after.config.layout.find(({i}) => i === 'a')).parent, 'right');
    assert.equal(checked(after.config.layout.find(({i}) => i === 'a')).w, 10);
    assert.equal(checked(after.config.layout.find(({i}) => i === 'a')).h, 4);
    assert.deepEqual(
        after.config.layout.find(({i}) => i === 'b'),
        before.config.layout.find(({i}) => i === 'b'),
    );
    assert.deepEqual(
        after.widgets.map(({id, instance}) => [id, instance]),
        before.widgets.map(({id, instance}) => [id, instance]),
    );

    const returned = await dragTo(checked(after.widgets.find(({id}) => id === 'a')).rect, {
        x: source.x + 100,
        y: source.y + 55,
    });
    assert.equal(returned.a.h, 10);
    const back = await snapshot();
    assert.equal(back.events, 'Events: 2');
    assert.equal(checked(back.config.layout.find(({i}) => i === 'a')).parent, 'left');
    assert.equal(checked(back.config.layout.find(({i}) => i === 'a')).h, 10);

    const rect = checked(back.widgets.find(({id}) => id === 'a')).rect;
    const x = rect.x + rect.width / 2;
    const y = rect.bottom - 12;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 5, y + 5);
    await page.mouse.move(target.x + 120, target.y + 35, {steps: 16});
    const inTarget = await page.locator('[data-dashkit-id="a"]').evaluate((el) => {
        const host = el as NativeElement & {_gridstackNodeOrig?: NativeElement['gridstackNode']};
        return {
            source: host.parentElement?.closest('[data-fit-zone]')?.getAttribute('data-fit-zone'),
            target: host.gridstackNode.grid.el
                .closest('[data-fit-zone]')
                ?.getAttribute('data-fit-zone'),
            sourceHeight: host._gridstackNodeOrig?.h,
            previewHeight: host.gridstackNode.h,
        };
    });
    assert.deepEqual(inTarget, {
        source: 'left',
        target: 'right',
        sourceHeight: 10,
        previewHeight: 4,
    });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await frames();
    const cancelled = await snapshot();
    assert.deepEqual(cancelled.config, back.config);
    assert.equal(cancelled.events, back.events);
    const next = await dragTo(checked(cancelled.widgets.find(({id}) => id === 'a')).rect, {
        x: target.x + 120,
        y: target.y + 35,
    });
    assert.equal(next.a.h, 4);
    const final = await snapshot();
    assert.equal(final.events, 'Events: 3');
    assert.equal(checked(final.config.layout.find(({i}) => i === 'a')).parent, 'right');
    assert.equal(checked(final.config.layout.find(({i}) => i === 'a')).h, 4);
    evidence.push({before, preview, after, returned, back, inTarget, cancelled, next, final});
});
