import React from 'react';

import {
    ChartColumn,
    Check,
    CircleExclamationFill,
    Copy,
    Gear,
    Heading,
    Layers3Diagonal,
    PlugConnection,
    Sliders,
    TextAlignLeft,
    TrashBin,
} from '@gravity-ui/icons';
import {Button, Icon} from '@gravity-ui/uikit';

import {ActionPanel, DashKit, DashKitProps} from '../../..';
import {MenuItems} from '../../../helpers';
import {i18n} from '../../../i18n';
import type {ConfigItem, OverlayControlItem, PreparedCopyItemOptions} from '../../../index';
import {cn} from '../../../utils/cn';

import {Demo, DemoRow} from './Demo';
import {getConfig, makeid, specialWidgetId, titleId} from './utils';

import './DashKitShowcase.scss';

const b = cn('stories-dashkit-showcase');

type DashKitDemoState = {
    editMode: boolean;
    settings: DashKitProps['settings'];
    config: DashKitProps['config'];
    itemsStateAndParams: NonNullable<DashKitProps['itemsStateAndParams']>;
    defaultGlobalParams: DashKitProps['defaultGlobalParams'];
    globalParams: DashKitProps['globalParams'];

    lastAction: string;
    customControlsActionData: number;
    enableActionPanel: boolean;
    enableAnimations: boolean;
    enableOverlayControls: boolean;
    overlayMenuItems: DashKitProps['overlayMenuItems'];
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
        enableActionPanel: false,
        enableAnimations: true,
        enableOverlayControls: true,
        overlayMenuItems: null,
    };

    private controls: Record<string, OverlayControlItem[]>;

    private dashKitRef = React.createRef<DashKit>();

    constructor(props: {}) {
        super(props);

        this.controls = {
            custom: [
                {
                    title: 'Edit custom widget',
                    icon: Check,
                    handler: this.onCustomWidgetControlClick,
                    iconSize: 16,
                },
            ],
            allWidgetsControls: [
                {
                    allWidgetsControls: true,
                    title: 'Icon tooltip 1',
                    icon: Check,
                    handler: () => console.log('overlayControls::custom click'),
                    iconSize: 16,
                    visible: (item) => item.type !== 'text',
                },
                {
                    allWidgetsControls: true,
                    excludeWidgetsTypes: ['title'],
                    id: MenuItems.Settings,
                    title: 'Settings default',
                    icon: CircleExclamationFill,
                },
                {
                    allWidgetsControls: true,
                    title: 'Icon tooltip 2',
                    handler: () => console.log('overlayControls::custom click'),
                    visible: (item) => item.type !== 'text',
                },
            ],
        };
    }

    render() {
        console.log('customControlsActionData', this.state.customControlsActionData);
        const {editMode} = this.state;

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
                            onClick={() => this.toggleAnimations()}
                            className={b('btn-contol')}
                            disabled={!editMode}
                        >
                            {this.state.enableAnimations
                                ? 'Disable animations'
                                : 'Enable animations'}
                        </Button>
                        <Button
                            view="normal"
                            size="m"
                            onClick={this.toggleOverlayControls}
                            className={b('btn-contol')}
                            disabled={!editMode}
                        >
                            {this.state.enableOverlayControls
                                ? 'Hide left controls'
                                : 'Show left controls'}
                        </Button>
                        <Button
                            view="normal"
                            size="m"
                            onClick={this.toggleCustomMenu}
                            className={b('btn-contol')}
                            disabled={!editMode}
                        >
                            {this.state.overlayMenuItems
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
                            onClick={this.prependTitle}
                            className={b('btn-contol')}
                        >
                            Prepend widget Title
                        </Button>
                        <Button
                            view="normal"
                            size="m"
                            onClick={this.addAfterSpecialItem}
                            className={b('btn-contol')}
                        >
                            Add Title after special
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
                        <Button
                            view="normal"
                            size="m"
                            onClick={() => this.toggleActionPanel()}
                            className={b('btn-contol')}
                            disabled={!editMode}
                        >
                            {this.state.enableActionPanel
                                ? 'Disable action panel'
                                : 'Enable action panel'}
                        </Button>
                    </div>
                </DemoRow>
                <DemoRow title="Last action in DashKit">{this.state.lastAction}</DemoRow>
                <DemoRow title="Component view">
                    <ActionPanel
                        items={this.getActionPanelItems()}
                        toggleAnimation={this.state.enableAnimations}
                        disable={editMode ? !this.state.enableActionPanel : true}
                    />
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
                        overlayControls={this.state.enableOverlayControls ? this.controls : null}
                        overlayMenuItems={this.state.overlayMenuItems}
                        focusable={true}
                        context={{
                            onCopySuccess: (data: PreparedCopyItemOptions) =>
                                console.info('Copied: ' + JSON.stringify(data)),
                        }}
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

    private addAfterSpecialItem = () => {
        const specialWidget = this.state.config.layout.find(({i}) => {
            return i === specialWidgetId;
        });

        if (specialWidget) {
            const config = DashKit.setItem({
                item: {
                    data: {
                        size: 'm',
                        text: `addTitle rand-${makeid(4)}`,
                        showInTOC: false,
                    },
                    type: 'title',
                    layout: {
                        y: specialWidget.y + specialWidget.h - 1,
                        x: specialWidget.x,
                        h: 5,
                        w: 10,
                    },
                },
                namespace: 'default',
                config: this.state.config,
            });
            this.setState({
                config,
                lastAction: `[DashKit.setItem] added after new widget Title: ${new Date().toISOString()}`,
            });
        }
    };

    private prependTitle = () => {
        const config = DashKit.setItem({
            item: {
                data: {
                    size: 'm',
                    text: `addTitle rand-${makeid(4)}`,
                    showInTOC: false,
                },
                type: 'title',
                layout: {
                    y: 0,
                    x: 0,
                    h: 5,
                    w: 10,
                },
            },
            namespace: 'default',
            config: this.state.config,
        });
        this.setState({
            config,
            lastAction: `[DashKit.setItem] prepended new widget Title: ${new Date().toISOString()}`,
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

    private toggleOverlayControls = () => {
        this.setState({enableOverlayControls: !this.state.enableOverlayControls});
    };

    private toggleCustomMenu = () => {
        if (this.state.overlayMenuItems) {
            this.setState({overlayMenuItems: null});
        } else {
            this.setState({
                overlayMenuItems: [
                    {
                        id: 'settings',
                        title: 'Menu setting text',
                        icon: <Icon data={Gear} size={16} />,
                        handler: () => {
                            console.log('menu::settings::click');
                        },
                        visible: (item) => item.type !== 'custom',
                    },
                    {
                        id: MenuItems.Copy,
                        title: 'Menu setting copy',
                        icon: <Icon data={Copy} size={16} />,
                        visible: (item) => item.type !== 'custom',
                    },
                    {
                        id: MenuItems.Delete,
                        title: i18n('label_delete'), // for language change check
                        icon: <Icon data={TrashBin} size={16} />,
                        className: 'dashkit-overlay-controls__item_danger',
                        visible: (item) => item.type !== 'custom',
                    },
                ],
            });
        }
    };

    private toggleActionPanel() {
        this.setState({enableActionPanel: !this.state.enableActionPanel});
    }

    private toggleAnimations() {
        this.setState({enableAnimations: !this.state.enableAnimations});
    }

    private getActionPanelItems() {
        return [
            {
                id: 'chart',
                icon: <Icon data={ChartColumn} />,
                title: 'Chart',
                className: 'test',
                qa: 'chart',
            },
            {
                id: 'selector',
                icon: <Icon data={Sliders} />,
                title: 'Selector',
                qa: 'selector',
            },
            {
                id: 'text',
                icon: <Icon data={TextAlignLeft} />,
                title: 'Text',
            },
            {
                id: 'header',
                icon: <Icon data={Heading} />,
                title: 'Header',
            },
            {
                id: 'links',
                icon: <Icon data={PlugConnection} />,
                title: 'Links',
            },
            {
                id: 'tabs',
                icon: <Icon data={Layers3Diagonal} />,
                title: 'Tabs',
            },
        ];
    }
}
