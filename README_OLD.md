# DashKit

Библиотека для рендеринга сетки дашборда.

## Установка

```bash
npm i @yandex-cloud/dashkit
```

## Описание

Библиотека позволяет выстраивать виджеты в сетку, изменять их размеры, добавлять новые, удалять.
Виджет представляет из себя react-компоненту. К примеру, текст, график, картинка и т.п.

Добавление новых виджетов осуществляется через систему плагинов.

### Плагины

Плагины нужны для создания собственных виджетов.

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
- **editMode**: включен ли режим редактирования.
- **onItemEdit**: вызывается, когда нажали на редактирование виджета.
- **onChange**: вызывается, когда поменялся config или [itemsStateAndParams](#temsStateAndParams).
- **defaultGlobalParams**, **globalParams**: [параметры](#Params), которые влияют на все виджеты. В DataLens `defaultGlobalParams` - глобальные параметры, заданные в настройках дашборда. `globalParams` - глобальные параметры, которые можно задать в урле.
- **itemsStateAndParams**: [itemsStateAndParams](#temsStateAndParams).
- **settings**: настройки DashKit.
- **context**: объект, который пробросится пропсом во все виджеты.
- **overlayControls**: объект, который переопределяет контролы виджета в момент редактирования. Если не передали, то будут отображаться базовые контролы.
- **noOverlay**: если `true` - оверлей и контроллы в момента редактирования не отображаются
- **draggableHandleClassName** - имя css класса у элемента за который будет возможно перетескивание виджета

## Использование

### Конфигурирование DashKit

Прежде чем использовать `DashKit` как react-компоненту, его необходимо сконфигурировать.

- DashKit.setSettings

  Используется для глобальных настроек DashKit (отступы между виджетами, дефолтные размеры виджетов и т.п.)

  ```js
  import {DashKit} from '@yandex-cloud/dashkit';

  DashKit.setSettings({
    gridLayout: {margin: [8, 8]},
    isMobile: true,
  });
  ```

- DashKit.registerPlugins

  Регистрируем и конфигурируем плагины

  ```js
  import {DashKit} from '@yandex-cloud/dashkit';
  import pluginTitle from '@yandex-cloud/dashkit/build/plugins/Title/Title';
  import pluginText from '@yandex-cloud/dashkit/build/plugins/Text/Text';

  DashKit.registerPlugins(
    pluginTitle,
    pluginText.setSettings({
      apiHandler({text}) {
        return api.getMarkdown(text);
      },
    }),
  );
  ```

### Config

[Пример конфига в DataLens](https://datalens.yandex-team.ru/docs/api/dash/scheme)

```ts
export interface Config {
  salt: string; // для формирования уникального id
  counter: number; // для формирования уникального id, только увеличивается
  items: ConfigItem[]; //  начальные состояния виджетов
  layout: ConfigLayout[]; // позиция виджетов на сетке
  aliases: ConfigAliases; // алиасы для параметров
  connections: ConfigConnection[]; // связи между виджетами
}
```

### Params

```ts
type Params = Record<string, string | string[]>;
```

`DashKit` формирует параметры, согласно дефолтным параметрам виджетов, связам и алисам. Эти параметры необходимы для библиотеки [ChartKit](https://github.yandex-team.ru/data-ui/chartkit#доступные-свойства).

Порядок формирования:

1. `defaultGlobalParams`
2. Дефольные параметры виджетов `item.default`
3. `globalParams`
4. Параметры из [itemsStateAndParams](#itemsStateAndParams), согласно очереди.

### itemsStateAndParams

Объект, который хранит параметры и стейты виджетов, а также очередь изменения параметров.
В нем есть поле `__meta__`, для хранения очереди и мета информации.

```ts
interface StateAndParamsMeta = {
    __meta__: {
        queue: {id: string}[]; // очередь
        version: number; // текущая версия itemsStateAndParams
    };
}
```

А также стейты и параметры виджетов:

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

### Shared

Код из папки shared может использоваться на серверной стороне. В DataLens используется в сервисе почтовой рассылке, чтобы на сервере сформировать параметры для виджета и снять скриншот состояния.

## Разаботка

### Build & watch

- сборка зависимостей `npm ci`
- сборка проекта `npm run build`
- сборка storybook `npm run dev`

По умолчанию запускается storybook на `http://localhost:7120/`.
Бывает, что не всегда подхватываются свежие изменения из проекта при запущенном storybook, лучше пересобрать проект вручную и перезапустить storybook.

### Пример конфига nginx для разработки на dev-машине

```bash
server {
    server_name dashkit.marginy.ui.yandex-team.ru;

    include common/ssl;

    access_log /home/marginy/logs/common.access.log;
    error_log /home/marginy/logs/common.error.log;

    root /home/marginy/projects/dashkit;

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
