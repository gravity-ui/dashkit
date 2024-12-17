import React from 'react';

import noop from 'lodash/noop';
import pick from 'lodash/pick';

import {DEFAULT_GROUP, DEFAULT_NAMESPACE} from '../../constants';
import {DashKitDnDContext} from '../../context';
import type {
    Config,
    ConfigItem,
    ConfigLayout,
    GlobalParams,
    ItemDropProps,
    ItemsStateAndParams,
} from '../../shared';
import type {
    AddConfigItem,
    AddNewItemOptions,
    ContextProps,
    DashKitGroup,
    GridReflowOptions,
    ItemManipulationCallback,
    MenuItem,
    Plugin,
    ReactGridLayoutProps,
    SetConfigItem,
    Settings,
    SettingsProps,
} from '../../typings';
import {RegisterManager, UpdateManager, reflowLayout} from '../../utils';
import {DashKitDnDWrapper} from '../DashKitDnDWrapper/DashKitDnDWrapper';
import DashKitView from '../DashKitView/DashKitView';
import GridLayout from '../GridLayout/GridLayout';
import type {OverlayControlItem, PreparedCopyItemOptions} from '../OverlayControls/OverlayControls';

interface DashKitGeneralProps {
    config: Config;
    editMode: boolean;
    draggableHandleClassName?: string;
    overlayControls?: Record<string, OverlayControlItem[]> | null;
    overlayMenuItems?: MenuItem[] | null;
}

interface DashKitDefaultProps {
    defaultGlobalParams: GlobalParams;
    globalParams: GlobalParams;
    itemsStateAndParams: ItemsStateAndParams;
    settings: SettingsProps;
    context: ContextProps;
    noOverlay: boolean;
    focusable?: boolean;
    groups?: DashKitGroup[];

    onItemEdit: (item: ConfigItem) => void;
    onChange: (data: {
        config: Config;
        itemsStateAndParams: ItemsStateAndParams;
        groups?: DashKitGroup[];
    }) => void;

    onDrop?: (dropProps: ItemDropProps) => void;

    onItemMountChange?: (item: ConfigItem, state: {isAsync: boolean; isMounted: boolean}) => void;
    onItemRender?: (item: ConfigItem) => void;

    getPreparedCopyItemOptions?: (options: PreparedCopyItemOptions) => PreparedCopyItemOptions;
    onCopyFulfill?: (error: null | Error, data?: PreparedCopyItemOptions) => void;

    onDragStart?: ItemManipulationCallback;
    onDrag?: ItemManipulationCallback;
    onDragStop?: ItemManipulationCallback;
    onResizeStart?: ItemManipulationCallback;
    onResize?: ItemManipulationCallback;
    onResizeStop?: ItemManipulationCallback;
}

export interface DashKitProps extends DashKitGeneralProps, Partial<DashKitDefaultProps> {}

type DashKitInnerProps = DashKitGeneralProps & DashKitDefaultProps;

const registerManager = new RegisterManager();

const getReflowProps = (props: ReactGridLayoutProps): GridReflowOptions =>
    Object.assign(
        {compactType: 'vertical', cols: 36},
        pick(props, 'cols', 'maxRows', 'compactType'),
    );

const getReflowGroupsConfig = (groups: DashKitGroup[] = []) => {
    const defaultGridProps = getReflowProps(registerManager.gridLayout);

    return {
        defaultProps: defaultGridProps,
        groups: groups.reduce<Record<string, GridReflowOptions>>((memo, g) => {
            const groupId = g.id || DEFAULT_GROUP;
            memo[groupId] = g.gridProperties
                ? getReflowProps(g.gridProperties(defaultGridProps))
                : defaultGridProps;

            return memo;
        }, {}),
    };
};

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
        focusable: false,
    };

    static contextType = DashKitDnDContext;

    static registerPlugins(...plugins: Plugin[]) {
        plugins.forEach((plugin) => {
            registerManager.registerPlugin(plugin);
        });
    }

    static reloadPlugins(...plugins: Plugin[]) {
        plugins.forEach((plugin) => {
            registerManager.reloadPlugin(plugin);
        });
    }

    static setSettings(settings: Settings) {
        registerManager.setSettings(settings);
    }

    static setItem({
        item: setItem,
        namespace = DEFAULT_NAMESPACE,
        config,
        options = {},
        groups = [],
    }: {
        item: SetConfigItem;
        namespace?: string;
        config: Config;
        options?: Omit<AddNewItemOptions, 'reflowLayoutOptions'>;
        groups?: DashKitGroup[];
    }): Config {
        if (setItem.id) {
            return UpdateManager.editItem({
                item: setItem,
                namespace,
                config,
                options,
            });
        } else {
            const item = setItem as AddConfigItem;
            const layout = {...registerManager.getItem(item.type).defaultLayout};

            const reflowLayoutOptions = getReflowGroupsConfig(groups);

            const copyItem = {...item};

            if (copyItem.layout) {
                Object.assign(layout, copyItem.layout);
                delete copyItem.layout;
            }

            return UpdateManager.addItem({
                item: copyItem,
                namespace,
                config,
                layout,
                options: {...options, reflowLayoutOptions},
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

    static reflowLayout({
        newLayoutItem,
        layout,
        groups,
    }: {
        newLayoutItem?: ConfigLayout;
        layout: ConfigLayout[];
        groups?: DashKitGroup[];
    }) {
        return reflowLayout({
            newLayoutItem,
            layout,
            reflowLayoutOptions: getReflowGroupsConfig(groups),
        });
    }

    metaRef = React.createRef<GridLayout>();

    render() {
        const content = (
            <DashKitView registerManager={registerManager} ref={this.metaRef} {...this.props} />
        );

        if (!this.context && this.props.groups) {
            return <DashKitDnDWrapper>{content}</DashKitDnDWrapper>;
        }

        return content;
    }

    getItemsMeta() {
        return this.metaRef.current?.getItemsMeta();
    }

    reloadItems(options?: {targetIds?: string[]; force?: boolean}) {
        this.metaRef.current?.reloadItems(options);
    }
}
