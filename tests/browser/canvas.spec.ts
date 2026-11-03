import assert from 'node:assert/strict';

import type {Config} from '../../src/shared';

import {canvas, crossZone, near} from './canvas-utils';
import {checked, storyUrl, test} from './fixtures';
import type {NativeElement} from './types';
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

// Native portals retain cross-grid identity; legacy sharedDrop remounts the moved widget.
test('native cross-zone identity and atomic callback ordering', async ({page, evidence}) => {
    const {before, after, callbacks} = await crossZone(page);
    assert.equal(
        after.widgets.find(({id}) => id === 'b')?.instance,
        before.widgets.find(({id}) => id === 'b')?.instance,
    );
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
        check: 'native cross-zone portal identity and atomic grid callbacks',
        before,
        after,
        callbacks,
    });
});
