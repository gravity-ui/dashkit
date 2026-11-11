# Migration to DashKit 11

DashKit 11 moves to `@gravity-ui/uikit` 8 and compiles to ES2022. This page lists what changes for an application
and what to do about each change.

## Requirements

| Package              | DashKit 10                           | DashKit 11             |
| :------------------- | :----------------------------------- | :--------------------- |
| `@gravity-ui/uikit`  | `^7.0.0`                             | `^8.0.0`               |
| `react`, `react-dom` | `^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19` | `^18.0.0 \|\| ^19.0.0` |

Upgrade the application to uikit 8 first: see the
[uikit migration guide](https://github.com/gravity-ui/uikit/blob/main/docs/migration-to-v8.md). Two uikit
majors in one bundle are two sets of providers, and DashKit would not see the theme of the application.

## Theme provider

DashKit must be rendered inside the uikit `Provider` or `ThemeProvider`. In edit mode the widget menu now needs
the theme as soon as it renders. Before, it needed the theme only when the menu was opened.

## Widget overlay menu

The menu behind the "…" button of a widget is the uikit 8 `Menu` instead of the legacy `DropdownMenu`. The API of
DashKit did not change: `overlayMenuItems`, `Settings.menu`, and the `icon`, `className` and `qa` of a custom item
work as before.

What changes is the markup, so check your CSS overrides and tests:

- Items are `button.g-menu-item[role="menuitem"]` inside `.g-menu`. The `.g-dropdown-menu__*` classes and the
  `li > div[role="menuitem"]` structure are gone.
- `qa` of a custom item is the `data-qa` of that button.
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
- In Node, `require('@gravity-ui/dashkit')` needs `require(esm)` (Node 20.19 or 22.12 and later): uikit 8 brings
  dependencies that ship only ES modules. Bundlers are not affected. In Jest, transpile `colors-named` and
  `colors-named-hex` (`transformIgnorePatterns`) if a test renders real uikit components.
