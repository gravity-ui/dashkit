# Migration to DashKit 11

DashKit 11 moves to `@gravity-ui/uikit` 8 and compiles to ES2022. This page lists what changes for an application
and what to do about each change.

## Requirements

| Package              | DashKit 10                           | DashKit 11             |
| :------------------- | :----------------------------------- | :--------------------- |
| `@gravity-ui/uikit`  | `^7.0.0`                             | `^8.0.0`               |
| `@gravity-ui/icons`  | `^2.13.0`                            | `^2.20.0`              |
| `react`, `react-dom` | `^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19` | `^18.0.0 \|\| ^19.0.0` |

Upgrade the application to uikit 8 first: see the
[uikit migration guide](https://github.com/gravity-ui/uikit/blob/main/docs/migration-to-v8.md), also installed
as `node_modules/@gravity-ui/uikit/build/docs/guides/migration-to-v8.md`. Two uikit majors in one bundle are two
sets of providers, and DashKit would not see the theme of the application.

## Theme provider

DashKit must be rendered inside the uikit `Provider` or `ThemeProvider`. In edit mode the widget menu now needs
the theme as soon as it renders, so without a provider the dashboard throws "useTheme\* hooks must be used within
ThemeProvider". Before, the menu needed the theme only when it was opened.

## Widget overlay menu

The menu behind the "…" button of a widget is the uikit 8 `Menu` instead of the legacy `DropdownMenu`. The API of
DashKit did not change: `overlayMenuItems`, `Settings.menu`, and the `title`, `handler`, `visible`, `className` and
`qa` of a custom item work as before.

`iconSize` of a menu item is deprecated: the menu never applied it. Set the size on the icon element. `iconSize`
of an `overlayControls` button still works.

What changes is the markup, so check your CSS overrides and tests:

- Items are `button.g-menu-item[role="menuitem"]` inside `.g-menu`. The `.g-dropdown-menu__*` classes and the
  `li > div[role="menuitem"]` structure are gone.
- `role="menu"` is on the popup element around `.g-menu`, not on `.g-menu` itself: find the menu by its role
  (`getByRole('menu')`), not with `.g-menu[role="menu"]`.
- `qa` of a custom item is the `data-qa` of that button.
- `icon` of a custom item is rendered inside `div.g-menu-item__icon`, a 16px box. An `<Icon>` without `size` and an
  `<svg>` without `width` and `height` get 16px. Items without an icon are indented to line up with the ones that
  have it.
- To recolor an item through its `className`, set `--g-list-item-view-text-color`: a plain `color` has the same
  specificity as the uikit rule, so the order of the stylesheets decides.
- The "…" button is no longer wrapped in `div.g-dropdown-menu__switcher-wrapper`.
- The `dashkit_draggable_cancel` class is on `.g-menu` instead of the popup element.
- Rows follow the uikit 8 heights, see
  [Row heights of List, Select and Menu](https://github.com/gravity-ui/uikit/blob/main/docs/migration-to-v8.md#row-heights-of-list-select-and-menu).
- The menu no longer closes when an ancestor scrolls: it stays open and follows the button.

## Language

DashKit texts (the overlay menu, the error of the Text plugin) follow the language of the uikit `Provider`:

```tsx
<Provider theme="light" lang="ru">
  <DashKit {...props} />
</Provider>
```

Without `lang` on a `Provider` they follow `configure({lang})`, as before. An application that only calls
`configure` needs no change.

The texts now re-render when the language changes, from either source. A DashKit 10 application had to remount
DashKit or pass it a new `context` to see the new language; for the texts of DashKit itself that workaround can be
removed. The texts of the application, such as the titles of its menu items or plugins that take the language from
`context`, stay its own.

## ActionPanel

The default hover background of an item is `--g-color-base-contrast-light-simple-hover`: uikit 8 removed
`--g-color-base-light-simple-hover`. If a theme of yours set the old token to restyle the panel, set
`--dashkit-action-panel-item-color-hover` instead.

## Build output

- The package is compiled to ES2022. If the application supports browsers without ES2022, transpile
  `@gravity-ui/dashkit` in its build, as uikit 8 already requires.
- `lodash` is replaced with `es-toolkit`. `es-toolkit`, `tslib` and `@gravity-ui/i18n` are dependencies of DashKit,
  so nothing has to be installed next to it.
- Unit tests are no longer published in the package.
- The types of DashKit compile with `skipLibCheck: false`; DashKit 10 needed `skipLibCheck: true`. They need
  `@types/react` 18.2.6 or later (they use `React.JSX`), and with `moduleResolution: node10` also
  `esModuleInterop` or `allowSyntheticDefaultImports`, because they default-import `react` and
  `react-grid-layout`; `bundler`, `node16` and `nodenext` work as they are.
- `@types/react-grid-layout` is a dependency: the public types import `react-grid-layout`. It accepts any
  `@types/react`; if the package manager installs a second copy of `@types/react` for it next to the application's
  one, dedupe it (`overrides` in npm, `resolutions` in yarn).
- uikit 8 brings two dependencies that ship only ES modules, `colors-named` and `colors-named-hex`, and they load
  with any import of `@gravity-ui/uikit`. Bundlers are not affected.

  - In Jest, a test that imports `@gravity-ui/uikit` or DashKit without mocking uikit fails to load them: Jest 29
    reports "SyntaxError: Unexpected token 'export'", Jest 30 "Must use import to load ES Module". Take the two
    packages out of `transformIgnorePatterns` and let a transformer that turns ES modules into CommonJS handle
    their `.js` files. Keep the rest of the configuration, such as the CSS stub and jsdom. Transformers that do it:

    - `ts-jest` 29.3.2 or later, by itself; 29.3.0 and 29.3.1 only with `"isolatedModules": true`; older versions
      leave the files as they are;
    - `babel-jest` with `@babel/preset-env` or `@babel/plugin-transform-modules-commonjs` 7.x in a project-wide
      `babel.config.js`: a `.babelrc` does not apply to files in `node_modules`;
    - a small transformer for these two packages only, which works with any `ts-jest`; `jest/esmTransform.js` in
      the DashKit repository is one (it calls `typescript.transpileModule`).

    ```js
    // jest.config.js (jest.config.cjs in a package with "type": "module"), with ts-jest 29.3.2 or later
    module.exports = {
      transform: {
        '^.+\\.[jt]sx?$': 'ts-jest',
      },
      transformIgnorePatterns: ['/node_modules/(?!(colors-named|colors-named-hex)/)'],
      // with pnpm, whose packages live in node_modules/.pnpm:
      // transformIgnorePatterns: ['/node_modules/\\.pnpm/(?!(colors-named|colors-named-hex)@)'],
    };
    ```

  - In Node, the CommonJS build needs `require(esm)` for them (Node 20.19 or 22.12 and later). The main entry
    also imports CSS and needs a DOM, so it loads only under a bundler or a test runner that stubs CSS;
    `@gravity-ui/dashkit/helpers` loads in plain Node.
