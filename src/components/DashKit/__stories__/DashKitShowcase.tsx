import React from 'react';
import block from 'bem-cn-lite';
import {Button, Icon} from '@gravity-ui/uikit';
import {DashKit, DashKitProps, MenuItems, ConfigItem} from '../../..';
import {TickIcon} from '../../../icons/TickIcon';
import {CogIcon} from '../../../icons/CogIcon';
import {CopyIcon} from '../../../icons/CopyIcon';
import {DeleteIcon} from '../../../icons/DeleteIcon';
import {WarningIcon} from '../../../icons/WarningIcon';
import i18n from '../../../i18n';
import {getConfig, makeid, titleId} from './utils';
import {Demo, DemoRow} from './Demo';
import './DashKitShowcase.scss';

const b = block('stories-dashkit-showcase');

type DashKitDemoState = {
    editMode: boolean;
    settings: DashKitProps['settings'];
    config: DashKitProps['config'];
    itemsStateAndParams: NonNullable<DashKitProps['itemsStateAndParams']>;
    defaultGlobalParams: DashKitProps['defaultGlobalParams'];
    globalParams: DashKitProps['globalParams'];

    lastAction: string;
    customControlsActionData: number;
    showCustomMenu: boolean;
};

export class DashKitShowcase extends React.Component<{}, DashKitDemoState> {
    state: DashKitDemoState = {
        config: getConfig(),
        editMode: true,
        settings: {
            silentLoading: true,
            autoupdateInterval: 0,
        },
        itemsStateAndParams: {},
        defaultGlobalParams: {},
        globalParams: {},

        lastAction: 'Nothing',
        customControlsActionData: 0,
        showCustomMenu: true,
    };

    private dashKitRef = React.createRef<DashKit>();

    componentDidMount() {
        this.toggleCustomMenu(true);
    }

    render() {
        console.log('customControlsActionData', this.state.customControlsActionData);
        const {editMode} = this.state;
        const controls = {
            custom: [
                {
                    title: 'Edit custom widget',
                    icon: TickIcon,
                    handler: this.onCustomWidgetControlClick,
                    iconSize: 16,
                },
            ],
            allWidgetsControls: [
                {
                    allWidgetsControls: true,
                    title: 'Icon tooltip 1',
                    icon: TickIcon,
                    handler: () => console.log('overlayControls::custom click'),
                    iconSize: 16,
                },
                {
                    allWidgetsControls: true,
                    excludeWidgetsTypes: ['title'],
                    id: MenuItems.Settings,
                    title: 'Settings default',
                    icon: WarningIcon,
                },
                {
                    allWidgetsControls: true,
                    title: 'Icon tooltip 2',
                    handler: () => console.log('overlayControls::custom click'),
                },
            ],
        };

        return (
            <Demo title="DashKit">
                <DemoRow title="Controls">
                    <Button
                        view="action"
                        size="m"
                        onClick={() => this.setState({editMode: !editMode})}
                    >
                        {editMode ? 'Disable editMode' : 'Enable editMode'}
                    </Button>
                    <div className={b('controls-line')}>
                        <Button
                            view="normal"
                            size="m"
                            onClick={() => this.toggleCustomMenu(false)}
                            className={b('btn-contol')}
                            disabled={!editMode}
                        >
                            {this.state.showCustomMenu
                                ? 'Disable custom menu'
                                : 'Enable custom menu'}
                        </Button>
                        <Button
                            view="normal"
                            size="m"
                            onClick={this.addText}
                            className={b('btn-contol')}
                        >
                            Add widget Text
                        </Button>
                        <Button
                            view="normal"
                            size="m"
                            onClick={this.addTitle}
                            className={b('btn-contol')}
                        >
                            Add widget Title
                        </Button>
                        <Button
                            view="normal"
                            size="m"
                            onClick={this.changeTitle}
                            className={b('btn-contol')}
                        >
                            Change widget Title text
                        </Button>
                        <Button
                            view="normal"
                            size="m"
                            onClick={this.removeTitle}
                            className={b('btn-contol')}
                            disabled={!this.isTitleInConfig()}
                        >
                            Delete widget Title
                        </Button>
                        <Button
                            view="outlined"
                            size="m"
                            onClick={this.getItemsMeta}
                            className={b('btn-contol')}
                        >
                            ref.getItemsMeta
                        </Button>
                    </div>
                </DemoRow>
                <DemoRow title="Last action in DashKit">{this.state.lastAction}</DemoRow>
                <DemoRow title="Component view">
                    <DashKit
                        config={this.state.config}
                        editMode={editMode}
                        itemsStateAndParams={this.state.itemsStateAndParams}
                        defaultGlobalParams={this.state.defaultGlobalParams}
                        globalParams={this.state.globalParams}
                        onItemEdit={this.onItemEdit}
                        onChange={this.onChange}
                        settings={this.state.settings}
                        ref={this.dashKitRef}
                        overlayControls={controls}
                    />
                </DemoRow>
            </Demo>
        );
    }

    private onCustomWidgetControlClick = () => {
        const customControlsActionData = Math.random();
        alert(`customControlsActionData = ${customControlsActionData}`);

        this.setState({
            customControlsActionData,
        });
    };

    private onItemEdit = ({id, type, namespace, data}: ConfigItem) => {
        console.log('id', id);
        console.log('type', type);
        console.log('namespace', namespace);
        console.log('data', data);
        this.setState({
            lastAction: `[onItemEdit] Widget (id = '${id}') has been changed: ${new Date().toISOString()}`,
        });
    };

    private onChange = ({
        config,
        itemsStateAndParams,
    }: {
        config: DashKitProps['config'];
        itemsStateAndParams: DashKitProps['itemsStateAndParams'];
    }) => {
        console.log('config', config);
        console.log('itemsStateAndParams', itemsStateAndParams);

        this.setState({
            lastAction: `[onChange] config or itemsStateAndParams has been changed: ${new Date().toISOString()}`,
        });

        if (config) {
            this.setState({config});
        }
        if (itemsStateAndParams) {
            this.setState({itemsStateAndParams});
        }
    };

    private changeTitle = () => {
        if (!this.isTitleInConfig()) {
            return;
        }
        const config = DashKit.setItem({
            item: {
                id: titleId,
                data: {
                    size: 'm',
                    text: `Title rand-${makeid(4)}`,
                    showInTOC: true,
                },
                namespace: 'default',
                type: 'title',
            },
            config: this.state.config,
        });
        this.setState({
            config,
            lastAction: `[DashKit.setItem] widget Title changed: ${new Date().toISOString()}`,
        });
    };

    private removeTitle = () => {
        if (!this.isTitleInConfig()) {
            return;
        }
        const {config, itemsStateAndParams} = DashKit.removeItem({
            id: titleId,
            config: this.state.config,
            itemsStateAndParams: this.state.itemsStateAndParams,
        });

        this.setState({
            config,
            itemsStateAndParams,
            lastAction: `[DashKit.removeItem] widget Title deleted: ${new Date().toISOString()}`,
        });
    };

    private addText = () => {
        const config = DashKit.setItem({
            item: {
                data: {
                    text: `addItem rand-${makeid(4)}`,
                },
                namespace: 'default',
                type: 'text',
            },
            config: this.state.config,
        });
        this.setState({
            config,
            lastAction: `[DashKit.setItem] add  new widget Text: ${new Date().toISOString()}`,
        });
    };

    private addTitle = () => {
        const config = DashKit.setItem({
            item: {
                data: {
                    size: 'm',
                    text: `addTitle rand-${makeid(4)}`,
                    showInTOC: false,
                },
                type: 'title',
            },
            namespace: 'default',
            config: this.state.config,
        });
        this.setState({
            config,
            lastAction: `[DashKit.setItem] add  new widget Title: ${new Date().toISOString()}`,
        });
    };

    private getItemsMeta = async () => {
        // Get meta from plugins if they have a public method  getMeta(),
        // which will return a Promise, so you can get information from the plugin instance
        if (this.dashKitRef.current) {
            const itemsMetas = await Promise.all(this.dashKitRef.current.getItemsMeta());
            // There is no such method in the Title and Text plugin
            console.log(itemsMetas);
        }
    };

    private isTitleInConfig() {
        return Boolean(this.state.config.items.find((item) => item.id === titleId));
    }

    private toggleCustomMenu = (init = false) => {
        const {showCustomMenu} = this.state;
        if (showCustomMenu) {
            DashKit.setSettings({menu: []});
        } else {
            DashKit.setSettings({
                menu: [
                    {
                        id: 'settings',
                        title: 'Menu setting text',
                        icon: <Icon data={CogIcon} size={16} />,
                        handler: () => {
                            console.log('menu::settings::click');
                        },
                    },
                    {
                        id: MenuItems.Copy,
                        title: 'Menu setting copy',
                        icon: <Icon data={CopyIcon} size={16} />,
                    },
                    {
                        id: MenuItems.Delete,
                        title: i18n('label_delete'), // for language change check
                        icon: <Icon data={DeleteIcon} size={16} />,
                        className: 'dashkit-overlay-controls__item_danger',
                    },
                ],
            });
        }
        this.setState({
            showCustomMenu: !showCustomMenu,
            lastAction: init
                ? this.state.lastAction
                : `[DashKit.setSettings] toggle show custom widget menu: ${new Date().toISOString()}`,
        });
    };
}
