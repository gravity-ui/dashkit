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
    SetItemOptions,
    WidgetLayout,
} from '../../typings';
import {GlobalParams, Config, ConfigItem, ItemsStateAndParams} from '../../shared';

import {OverlayControlItem} from '../OverlayControls/OverlayControls';

interface DashKitGeneralProps {
    config: Config;
    editMode: boolean;
}

interface DashKitDefaultProps {
    onItemEdit: (item: ConfigItem) => void;
    onChange: (data: {config: Config; itemsStateAndParams: ItemsStateAndParams}) => void;
    onAddByDrop: (layout: WidgetLayout[], layoutItem: WidgetLayout) => void;
    defaultGlobalParams: GlobalParams;
    globalParams: GlobalParams;
    itemsStateAndParams: ItemsStateAndParams;
    settings: SettingsProps;
    context: ContextProps;
    overlayControls?: Record<string, OverlayControlItem[]>;
    noOverlay?: boolean;
    draggableHandleClassName?: string;
    dragFromOutside?: boolean;
}

export interface DashKitProps extends DashKitGeneralProps, Partial<DashKitDefaultProps> {}

type DashKitInnerProps = DashKitGeneralProps & DashKitDefaultProps;

const registerManager = new RegisterManager();

export class DashKit extends React.PureComponent<DashKitInnerProps> {
    static defaultProps: DashKitDefaultProps = {
        onItemEdit: noop,
        onChange: noop,
        onAddByDrop: noop,
        defaultGlobalParams: {},
        globalParams: {},
        itemsStateAndParams: {},
        settings: {
            autoupdateInterval: 0,
            silentLoading: false,
        },
        context: {},
        noOverlay: false,
        dragFromOutside: false,
    };

    static registerPlugins(...plugins: Plugin[]) {
        plugins.forEach((plugin) => {
            registerManager.registerPlugin(plugin);
        });
    }

    static setSettings(settings: Settings) {
        registerManager.setSettings(settings);
    }

    static setItem(
        {
            item: setItem,
            namespace = DEFAULT_NAMESPACE,
            config,
            options = {},
        }: {
            item: SetConfigItem;
            namespace?: string;
            config: Config;
            options?: SetItemOptions;
        },
        changedLayout?: WidgetLayout[],
    ): Config {
        if (setItem.id) {
            return UpdateManager.editItem({item: setItem, namespace, config, options});
        } else {
            const item = setItem as AddConfigItem;
            if (changedLayout) {
                return UpdateManager.addItemWithLayoutUpdate({
                    item,
                    namespace,
                    config,
                    layout: changedLayout,
                    options,
                });
            }

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
