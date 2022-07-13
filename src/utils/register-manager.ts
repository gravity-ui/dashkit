import {Plugin, PluginDefaultLayout, Settings} from '../typings';

interface RegisterManagerDefaultLayout {
    x: number;
    y: number;
    w: number;
    h: number;
    minW: number;
    minH: number;
}

export type RegisterManagerPluginLayout = RegisterManagerDefaultLayout & PluginDefaultLayout;

export interface RegisterManagerPlugin extends Omit<Plugin, 'defaultLayout'> {
    defaultLayout: RegisterManagerDefaultLayout & Plugin['defaultLayout'];
}

export type RegisterManagerGridLayout = {
    margin: [number, number];
    rowHeight: number;
    cols: number;
    containerPadding: [number, number];
} & Settings['gridLayout'];

export type RegisterManagerSettings = {theme: string} & Settings;

export class RegisterManager {
    private _items: Record<string, RegisterManagerPlugin> = {};
    private _defaultLayout: RegisterManagerDefaultLayout = {
        x: 0,
        y: Infinity,
        w: Infinity,
        h: 4,
        minW: 4,
        minH: 2,
    };
    private _gridLayout: RegisterManagerGridLayout = {
        rowHeight: 18,
        cols: 36,
        margin: [2, 2],
        containerPadding: [0, 0],
    };
    private _settings: RegisterManagerSettings = {
        theme: 'default',
    };

    registerPlugin(plugin: Plugin) {
        const {type, defaultLayout = {}, ...item} = plugin;
        if (type in this._items) {
            throw new Error(`DashKit.registerPlugins: type ${type} уже был зарегистрирован`);
        }
        if (typeof plugin.renderer !== 'function') {
            throw new Error('DashKit.registerPlugins: renderer должна быть функцией');
        }
        this._items[type] = {
            ...item,
            type,
            defaultLayout: {...this._defaultLayout, ...defaultLayout},
        };
    }

    setSettings(settings: Settings = {}) {
        Object.assign(this._settings, settings);
        if (settings.gridLayout) {
            this._gridLayout = {...this._gridLayout, ...settings.gridLayout};
        }
    }

    get settings() {
        return this._settings;
    }

    get gridLayout() {
        return this._gridLayout;
    }

    getPlugins() {
        return Object.values(this._items);
    }

    getItem(type: string) {
        return this._items[type];
    }

    check(type: string) {
        return type in this._items;
    }
}
