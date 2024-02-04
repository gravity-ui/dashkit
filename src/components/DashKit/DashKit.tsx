import React from 'react';
import noop from 'lodash/noop';
import {RegisterManager, UpdateManager} from '../../utils';
import DashKitView from '../DashKitView/DashKitView';
import GridLayout from '../GridLayout/GridLayout';
import {DEFAULT_NAMESPACE} from '../../constants';
import {
    SetConfigItem,
    Settings,
    SettingsProps,
    ContextProps,
    Plugin,
    AddConfigItem,
    SetNewItemOptions,
} from '../../typings';
import {GlobalParams, Config, ConfigItem, ConfigLayout, ItemsStateAndParams} from '../../shared';

import {OverlayControlItem} from '../OverlayControls/OverlayControls';

interface DashKitGeneralProps {
    config: Config;
    editMode: boolean;
    draggableHandleClassName?: string;
    overlayControls?: Record<string, OverlayControlItem[]>;
}

interface DashKitDefaultProps {
    onItemEdit: (item: ConfigItem) => void;
    onChange: (data: {config: Config; itemsStateAndParams: ItemsStateAndParams}) => void;
    onDrop: (pluginType: string, itemLayout: ConfigLayout, restLayout: ConfigLayout) => void;
    defaultGlobalParams: GlobalParams;
    globalParams: GlobalParams;
    itemsStateAndParams: ItemsStateAndParams;
    settings: SettingsProps;
    context: ContextProps;
    noOverlay: boolean;
}

export interface DashKitProps extends DashKitGeneralProps, Partial<DashKitDefaultProps> {}

type DashKitInnerProps = DashKitGeneralProps & DashKitDefaultProps;

const registerManager = new RegisterManager();

export class DashKit extends React.PureComponent<DashKitInnerProps> {
    static defaultProps: DashKitDefaultProps = {
        onItemEdit: noop,
        onChange: noop,
        onDrop: noop,
        defaultGlobalParams: {},
        globalParams: {},
        itemsStateAndParams: {},
        settings: {
            autoupdateInterval: 0,
            silentLoading: false,
        },
        context: {},
        noOverlay: false,
    };

    static registerPlugins(...plugins: Plugin[]) {
        plugins.forEach((plugin) => {
            registerManager.registerPlugin(plugin);
        });
    }

    // static getPlugin(type: string) {
    //     return registerManager.getItem(type);
    // }

    static setSettings(settings: Settings) {
        registerManager.setSettings(settings);
    }

    static setItem({
        item: setItem,
        namespace = DEFAULT_NAMESPACE,
        config,
        options = {},
    }: {
        item: SetConfigItem;
        namespace?: string;
        config: Config;
        options?: SetNewItemOptions;
    }): Config {
        if (setItem.id) {
            return UpdateManager.editItem({item: setItem, namespace, config, options});
        } else {
            const item = setItem as AddConfigItem;
            const layout = {...registerManager.getItem(item.type).defaultLayout};

            if (item.layout) {
                Object.assign(layout, item.layout);
            }

            return UpdateManager.addItem({
                item,
                namespace,
                config,
                layout,
                options,
            });
        }
    }

    static removeItem({
        id,
        config,
        itemsStateAndParams,
    }: {
        id: string;
        config: Config;
        itemsStateAndParams: ItemsStateAndParams;
    }): {config: Config; itemsStateAndParams: ItemsStateAndParams} {
        return UpdateManager.removeItem({id, config, itemsStateAndParams});
    }

    metaRef = React.createRef<GridLayout>();

    render() {
        return (
            <DashKitView
                // @ts-ignore
                registerManager={registerManager}
                ref={this.metaRef}
                {...this.props}
            />
        );
    }

    getItemsMeta() {
        return this.metaRef.current?.getItemsMeta();
    }
}
