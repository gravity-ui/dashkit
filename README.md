# @gravity-ui/dashkit &middot; [![npm package](https://img.shields.io/npm/v/@gravity-ui/dashkit)](https://www.npmjs.com/package/@gravity-ui/dashkit) [![CI](https://img.shields.io/github/actions/workflow/status/gravity-ui/dashkit/.github/workflows/ci.yaml?branch=main&label=CI&logo=github)](https://github.com/gravity-ui/dashkit/actions/workflows/ci.yaml?query=branch:main) [![storybook](https://img.shields.io/badge/Storybook-deployed-ff4685)](https://preview.gravity-ui.com/dashkit/)

# DashKit

A dashboard grid rendering library.

## Installation

```bash
npm i @gravity-ui/dashkit @gravity-ui/uikit
```

## Description

The library is used to line up widgets in a grid, resize them, add new ones, and delete them.
The widget is a react component. For example, text, graphics, and images.

New widgets are added via a plugin system.

### Plugins

Plugins are required to create custom widgets.

### Props

```ts
interface DashKitProps {
  config: Config;
  editMode: boolean;
  onItemEdit: ({id}: {id: string}) => void;
  onChange: (data: {config: Config; itemsStateAndParams: ItemsStateAndParams}) => void;
  defaultGlobalParams: GlobalParams;
  globalParams: GlobalParams;
  itemsStateAndParams: ItemsStateAndParams;
  settings: SettingsProps;
  context: ContextProps;
  overlayControls?: Record<string, OverlayControlItem[]>;
  noOverlay?: boolean;
}
```

- **config**: [сonfig](#Config).
- **editMode**: Whether edit mode is enabled.
- **onItemEdit**: Called when you click to edit a widget.
- **onChange**: Called when config or [itemsStateAndParams](#temsStateAndParams) are changed.
- **defaultGlobalParams**, **globalParams**: [Parameters](#Params) that affect all widgets. In DataLens, `defaultGlobalParams` are global parameters set in the dashboard settings. `globalParams` are globals parameters that can be set in the url.
- **itemsStateAndParams**: [itemsStateAndParams](#temsStateAndParams).
- **settings**: DashKit settings.
- **context**: Object that will be propped up on all widgets.
- **overlayControls**: Object that overrides widget controls at the time of editing. If not transmitted, basic controls will be displayed.
- **noOverlay**: If `true`, overlay and controls are not displayed while editing.
- **focusable**: If `true`, grid items will be focusable.
- **draggableHandleClassName** : СSS class name of the element that makes the widget draggable.

## Usage

### DashKit configuration

Before using `DashKit` as a react component, it must be configured.

- set language

  ```js
  import {configure, Lang} from '@gravity-ui/uikit';

  configure({lang: Lang.En});
  ```

- DashKit.setSettings

  Used for global DashKit settings (such as margins between widgets, default widget sizes and widget overlay menu)

  ```js
  import {DashKit} from '@gravity-ui/dashkit';

  DashKit.setSettings({
    gridLayout: {margin: [8, 8]},
    isMobile: true,
    // menu: [] as Array<MenuItem>,
  });
  ```

- DashKit.registerPlugins

  Registering and configuring plugins

  ```js
  import {DashKit} from '@gravity-ui/dashkit';
  import {pluginTitle, pluginText} from '@gravity-ui/dashkit';

  DashKit.registerPlugins(
    pluginTitle,
    pluginText.setSettings({
      apiHandler({text}) {
        return api.getMarkdown(text);
      },
    }),
  );

  DashKit.registerPlugins({
    type: 'custom',
    defaultLayout: {
      w: 10,
      h: 8,
    },
    renderer: function CustomPlugin() {
      return <div>Custom widget with custom controls</div>;
    },
  });
  ```

### Config

```ts
export interface Config {
  salt: string; // to form a unique id
  counter: number; // to form a unique id, only increases
  items: ConfigItem[]; //  initial widget states
  layout: ConfigLayout[]; // widget position on the grid https://github.com/react-grid-layout
  aliases: ConfigAliases; // aliases for parameters see #Params
  connections: ConfigConnection[]; // links between widgets see #Params
}
```

Config example:

```ts
import {DashKitProps} from '@gravity-ui/dashkit';

const config: DashKitProps['config'] = {
  salt: '0.46703554571365613',
  counter: 4,
  items: [
    {
      id: 'tT',
      data: {
        size: 'm',
        text: 'Caption',
        showInTOC: true,
      },
      type: 'title',
      namespace: 'default',
      orderId: 1,
    },
    {
      id: 'Ea',
      data: {
        text: 'mode _editActive',
        _editActive: true,
      },
      type: 'text',
      namespace: 'default',
    },
    {
      id: 'zR',
      data: {
        text: '### Text',
      },
      type: 'text',
      namespace: 'default',
      orderId: 0,
    },
    {
      id: 'Dk',
      data: {
        foo: 'bar',
      },
      type: 'custom',
      namespace: 'default',
      orderId: 5,
    },
  ],
  layout: [
    {
      h: 2,
      i: 'tT',
      w: 36,
      x: 0,
      y: 0,
    },
    {
      h: 6,
      i: 'Ea',
      w: 12,
      x: 0,
      y: 2,
    },
    {
      h: 6,
      i: 'zR',
      w: 12,
      x: 12,
      y: 2,
    },
    {
      h: 4,
      i: 'Dk',
      w: 8,
      x: 0,
      y: 8,
    },
  ],
  aliases: {},
  connections: [],
};
```

Add a new item to the config:

```ts
const newConfig = DashKit.setItem({
  item: {
    data: {
      text: `Some text`,
    },
    namespace: 'default',
    type: 'text',
  },
  config: config,
});
```

Change an existing item in the config:

```ts
const newConfig = DashKit.setItem({
  item: {
    id: 'tT', // item.id
    data: {
      size: 'm',
      text: `New caption`,
    },
    namespace: 'default',
    type: 'title',
  },
  config: config,
});
```

Delete an item from the config:

```ts
import {DashKitProps} from '@gravity-ui/dashkit';

const oldItemsStateAndParams: DashKitProps['itemsStateAndParams'] = {};

const {config: newConfig, itemsStateAndParams} = DashKit.removeItem({
  id: 'tT', // item.id
  config: config,
  itemsStateAndParams: this.state.itemsStateAndParams,
});
```

### Params

```ts
type Params = Record<string, string | string[]>;
```

`DashKit` generates parameters according to the default parameters for widgets, links, and aliases. These parameters are required for the [ChartKit](https://github.com/gravity-ui/chartkit) library.

Generation order:

1. `defaultGlobalParams`
2. Default widget parameters `item.default`
3. `globalParams`
4. Parameters from [itemsStateAndParams](#itemsStateAndParams) according to the queue.

### itemsStateAndParams

Object that stores widget parameters and states as well as a parameter change queue.
It has a `__meta__` field for storing queue and meta information.

```ts
interface StateAndParamsMeta = {
    __meta__: {
        queue: {id: string}[]; // queue
        version: number; // current version itemsStateAndParams
    };
}
```

And also widget states and parameters:

```ts
interface ItemsStateAndParamsBase {
  [itemId: string]: {
    state?: Record<string, any>;
    params?: Params;
  };
}
```

```ts
type ItemsStateAndParams = StateAndParamsMeta & ItemsStateAndParamsBase;
```

### Menu

You can specify custom DashKit widget overlay menu in edit mode

```ts
type MenuItem = {
  id: string; // uniq id
  title?: string; // string title
  icon?: ReactNode; // node of icon
  iconSize?: number | string; // icon size in px as number or as string with units
  handler?: (item: ConfigItem) => void; // custom item action handler
  visible?: (item: ConfigItem) => boolean; // optional visibility handler for filtering menu items
  className?: string; // custom class property
};

// use array of menu items in settings
DashKit.setSettings({menu: [] as Array<MenuItem>});
```

### CSS API

| Name                                           | Description           |
| :--------------------------------------------- | :-------------------- |
| Action panel variables                         |                       |
| `--dashkit-action-panel-color`                 | Background color      |
| `--dashkit-action-panel-border-color`          | Border color          |
| `--dashkit-action-panel-border-radius`         | Border radius         |
| Action panel item variables                    |                       |
| `--dashkit-action-panel-item-color`            | Backgroud color       |
| `--dashkit-action-panel-item-text-color`       | Text color            |
| `--dashkit-action-panel-item-color-hover`      | Hover backgroud color |
| `--dashkit-action-panel-item-text-color-hover` | Hover text color      |
| Overlay variables                              |                       |
| `--dashkit-overlay-border-color`               | Border color          |
| `--dashkit-overlay-color`                      | Background color      |
| `--dashkit-overlay-opacity`                    | Opacity               |
| Grid item variables                            |                       |
| `--dashkit-grid-item-edit-opacity`             | Opacity               |
| `--dashkit-grid-item-border-radius`            | Border radius         |
| Placeholder variables                          |                       |
| `--dashkit-placeholder-color`                  | Background color      |
| `--dashkit-placeholder-opacity`                | Opacity               |

#### Usage example

```css
.custom-theme-wrapper {
  --dashkit-grid-item-edit-opacit: 1;
  --dashkit-overlay-color: var(--g-color-base-float);
  --dashkit-overlay-border-color: var(--g-color-base-float);
  --dashkit-overlay-opacity: 0.5;

  --dashkit-action-panel-border-color: var(--g-color-line-info);
  --dashkit-action-panel-color: var(--g-color-base-float-accent);
  --dashkit-action-panel-border-radius: var(--g-border-radius-xxl);
}
```

```tsx
// ....

const CustomThemeWrapper = (props: {
  dashkitProps: DashkitProps;
  actionPanelProps: ActionPanelProps;
}) => {
  return (
    <div className="custom-theme-wrapper">
      <Dashkit {...props.dashkitProps} />
      <ActionPanel {...props.actionPanelProps} />
    </div>
  );
};
```

## Development

### Build & watch

- Build dependencies `npm ci`
- Build a project `npm run build`
- Build storybook `npm run start`

By default, storybook runs on `http://localhost:7120/`.
New changes from a project aren't always picked up when storybook is running, so it's better to rebuild a project manually and restart storybook.

### Example of an nginx config for development on a dev machine

```bash
server {
    server_name dashkit.username.ru;

    include common/ssl;

    access_log /home/username/logs/common.access.log;
    error_log /home/username/logs/common.error.log;

    root /home/username/projects/dashkit;

    location / {
        try_files $uri @node;
    }

    location @node {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass http://127.0.0.1:7120;
        proxy_redirect off;
    }
}

```
