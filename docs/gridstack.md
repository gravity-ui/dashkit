# GridStack layout

`DashKitGridStack` uses GridStack 12.6.0 for layout and native dragging and resizing. It shares DashKit's plugin registry, parameter processing, controls, events and readiness callbacks. The existing `DashKit` entry continues to use the legacy layout.

```tsx
import {DashKitGridStack} from '@gravity-ui/dashkit/gridstack';
import {pluginText} from '@gravity-ui/dashkit';

DashKitGridStack.registerPlugins(pluginText);

<DashKitGridStack config={config} editMode={editing} onChange={handleChange} />;
```

The separate entry includes its required styles. Keep importing shared components, built-in plugins and public types from the root, and helpers from `@gravity-ui/dashkit/helpers`. Registration and `setSettings` are shared across both components in one module instance. Do not register the same type twice; `reloadPlugins` replaces a registration.

## Existing API

The component accepts the existing DashKit props, including groups, parameters, item state, plugin context, overlays, focus callbacks, copy callbacks and drag/resize callbacks. Its ref supports `on('change', handler)` (returns an unsubscribe function), `getItemsMeta()` (an array of promises) and `reloadItems({targetIds, force})`. Existing registration, settings and item helpers remain available as statics. `reflowLayout` additionally accepts `containers` to resolve child-grid settings and treat sibling containers as fixed collision footprints. It returns widget layout only and leaves descriptors unchanged. New-item priority is independent of canonical saved order. `setItem` rejects insertion into a full horizontal-nowrap row. Direct `reflowLayout` retains the legacy transformation behavior for existing flat inputs, including packing/wrapping an explicitly over-budget layout; interactive admission still enforces the nowrap row budget.

`config` remains controlled. Replace it to apply undo, redo or an external document; this does not emit a change event. Geometry is reconciled by widget ID, preserving a widget's React instance and ref when it changes zone or container. Reordering `config.items` changes desktop stacking within a grid; mobile `orderId` retains its existing meaning.

The synchronous `change` event precedes `onChange`. Calling `event.preventDefault()` suppresses `onChange` and still advances the internal complete geometry baseline. A later parameter, copy or delete operation therefore uses the latest layout. Change events can include optional `containers` and `previousContainers`; an existing widget's membership patch can include `containerId`.

`onItemMountChange` and `onItemRender` describe plugin readiness. A layout event does not mean asynchronous content has finished rendering. Automatic widget height remains a visual adjustment; the original saved height is retained until an explicit resize or reset follows the existing DashKit contract. GridStack does not add lazy mount suppression to React plugins.

## Grid settings

`groups` remain runtime zones, with the existing `render` and `gridProperties` functions. The implementation supports vertical, horizontal, horizontal-nowrap and disabled compaction, overlap, collision prevention, size constraints, bounds, resize directions and custom resize handles. The legacy `verticalCompact: false` disables compaction.

Static `setItem` and `reflowLayout` resolve the same effective grid settings as the mounted layout. A `gridProperties` callback replaces the supplied settings; omitted geometry uses the legacy renderer defaults of 12 columns, row height 150 and margin/padding 10. Return `{...defaults, ...overrides}` to retain the supplied settings instead.

Root widths, margins and padding are CSS pixels; saved x/y/w/h use grid units. For a grid of width `W`, `C` columns, horizontal padding `P` and gap `G`, the column step is `(W - 2P + G) / C`; a widget of width `w` occupies `w * step - G` CSS pixels. Vertical step is `rowHeight + gapY`.

For a fixed pixel canvas, set `cols` to its unscaled width, `rowHeight: 1`, `margin: [0, 0]`, `compactType: null`, `allowOverlap: true` and a finite `maxRows`. Give the containing canvas a definite height and use `autoSize: false`; `maxRows` alone does not make an auto-sized zone tall.

Live `transformScale` and `transformScaleRef` values map screen movement to unscaled layout units, including zoom changes during an active gesture. Fixed canvas bounds intersect configured row limits and nested physical content bounds. Scale values must be finite and positive.

Ordinary auto-sized zones derive height from their content, gap and padding, including empty zones. They do not gain a minimum number of rows. A fluid grid's inline size is contained so the native grid's trailing gap cannot enlarge an ancestor's intrinsic width.

## Nested document format

Flat configurations continue to work without migration. The shared `LayoutContainer` type describes a persisted container; `GridStackContainer` remains a compatible alias. Nesting adds fields without changing widget IDs, data or existing layout coordinates:

```ts
const nested = {
  ...config,
  layoutVersion: 2,
  containers: [
    {
      id: 'panel',
      parent: 'slide',
      x: 20,
      y: 20,
      w: 400,
      h: 300,
      padding: [12, 20, 24, 16], // top, right, bottom, left; CSS pixels
      gap: [8, 6], // horizontal and vertical CSS pixels
      grid: {
        cols: 12,
        rowHeight: 18,
        compactType: null,
        allowOverlap: false,
        maxRows: 10,
      },
    },
  ],
  layout: config.layout.map((item) =>
    item.i === 'chart'
      ? {...item, parent: 'slide', containerId: 'panel', x: 0, y: 0, w: 6, h: 4}
      : item,
  ),
};
```

`parent` always identifies the root runtime zone. `containerId` identifies the immediate containing grid; x/y/w/h are local to that grid. A container can itself have `containerId`. Container padding has four independent sides and is separate from the child gap. Child grids inherit interaction flags and resize handles from their root zone; their persisted grid settings determine sizing, compaction, overlap and optional row bounds. Zone callbacks are not copied onto every nested grid. Contained child editing is bounded by the container’s usable height after padding and gap conversion; an optional `maxRows` can tighten that bound. The inferred bound is never saved, and valid fractional geometry is retained. Invalid native proposals are restored before a document transaction is emitted. Plugin autoheight is visual: nested height and its height constraints are capped to the remaining usable rows without changing the saved height or growing the parent; resetting restores the saved height.

The component validates duplicate/reserved IDs, geometry, padding, gaps, missing membership, cycles and inconsistent root zones before applying a document. Invalid input throws an explanatory error. The measured geometry and snapshot projection also reject nonpositive usable content width/height or children exceeding their container bounds; padding does not silently enlarge a saved container. Remove or move a container's children explicitly before deleting it; removing a nonempty container does not silently delete its subtree. Pass a nested configuration to `DashKitGridStack`; the legacy component explicitly rejects it.

Controlled changes can move widgets between zones and containers while preserving their plugin instance and portal target. Native dragging supports cross-zone and nested transfers, including whole container subtrees. Destinations validate available space and converted size constraints before admission. A release outside the reachable surface commits the last bounded preview; Escape cancels the transaction. External palette drops are not supported by this renderer. Resizing a container respects the extents of its children. Mobile mode traverses the hierarchy and renders each widget once using the existing mobile presentation.

For snapshots, import `getGridStackLayoutRects` and its rectangle/root-grid types from `@gravity-ui/dashkit/helpers`. `getGridStackLayoutRects(config, rootGrids)` returns widget rectangles in unscaled CSS pixels, accumulating container origins and padding. Supply each root zone's width and effective `gridProperties`; use `__default` for the default zone. It does not mount a grid, mutate a configuration or wait for plugin content.

## Packaging and local checks

The entry has ESM, CommonJS and TypeScript declarations. GridStack's published native modules use extensionless ESM imports; the CommonJS build includes a transpiled copy of the pinned runtime and its license. Run the library build when changing the runtime or dependency version. The renderer imports CSS in both module formats and requires an application bundler or an appropriate CSS loader for Node rendering. The existing helpers entry exports the pure projector without native runtime or CSS imports and can be required directly in Node.

The React peer range is unchanged. The new layout uses portals and the existing lifecycle shell; it does not require `createRoot` in consumer applications. Browser support follows modern GridStack requirements, including CSS variables and inline-size containment. ResizeObserver uses the existing polyfill when unavailable. A JavaScript build does not polyfill CSS features.

The public stories include small flat and nested examples. Detailed native interaction fixtures live only under `tests/browser/stories` and are loaded with `DASHKIT_TEST_STORIES=1`. Native tests use Storybook's normal bundler and server; Playwright starts it automatically:

```sh
npx playwright install chromium
npm run test:browser -- --project=chromium
# All installed engines (Chromium, Firefox, WebKit):
npm run test:browser
```

Playwright writes traces and failure screenshots to `test-results/` and its HTML report to `playwright-report/` (both ignored). `npm test` runs engine-independent helpers once, the same mounted flat contract for legacy and GridStack, and separate engine-specific suites. Separate native suites cover contained nesting, controlled cancellation and restoration, bounds, portal identity and StrictMode cleanup. The common flat browser contract runs with the same assertions for both renderers.

The native CDP touch transport check runs in Chromium; other native gesture and common public contracts run in Chromium, Firefox and WebKit.

Container geometry bounds admission and native edits. Container content keeps visible overflow so overlays and resize handles remain reachable.
