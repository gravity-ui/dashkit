import React, {DragEventHandler} from 'react';
import block from 'bem-cn-lite';
import {Icon} from '@gravity-ui/uikit';
import {DashKit, DashKitProps, MenuItems, ConfigItem, WidgetLayout} from '../../..';
import {TickIcon} from '../../../icons/TickIcon';
import {CogIcon} from '../../../icons/CogIcon';
import {CopyIcon} from '../../../icons/CopyIcon';
import {DeleteIcon} from '../../../icons/DeleteIcon';
import {WarningIcon} from '../../../icons/WarningIcon';
import i18n from '../../../i18n';
import {getConfig, gridItemsShowcase, gridLayoutShowcase, makeid} from './utils';
import {Demo, DemoRow} from './Demo';

import './DashKitGridShowcase.scss';

const b = block('dashkit-demo');

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
    _EXPERIMENTAL_preventDoubleCompact: boolean;
};

export class DashKitGridShowcase extends React.Component<{}, DashKitDemoState> {
    state: DashKitDemoState = {
        config: getConfig(gridItemsShowcase, gridLayoutShowcase),
        editMode: false,
        settings: {
            silentLoading: true,
            autoupdateInterval: 0,
        },
        itemsStateAndParams: {},
        defaultGlobalParams: {},
        globalParams: {},

        lastAction: 'Нет',
        customControlsActionData: 0,
        showCustomMenu: true,
        _EXPERIMENTAL_preventDoubleCompact: false,
    };

    private dashKitRef = React.createRef<DashKit>();

    componentDidMount() {
        this.toggleCustomMenu();
    }

    render() {
        console.log('customControlsActionData', this.state.customControlsActionData);
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
                <DemoRow title="Режим редактирования"></DemoRow>
                <DemoRow title="Изменения из DashKit">{this.state.lastAction}</DemoRow>
                <DemoRow title="Компонент">
                    <div
                        className={b('out')}
                        draggable={true}
                        unselectable="on"
                        onDragStart={this._onDragStart}
                    >
                        Drag me
                    </div>
                    <DashKit
                        dragFromOutside={true}
                        config={this.state.config}
                        editMode={true}
                        itemsStateAndParams={this.state.itemsStateAndParams}
                        defaultGlobalParams={this.state.defaultGlobalParams}
                        globalParams={this.state.globalParams}
                        onItemEdit={this.onItemEdit}
                        onAddByDrop={this.onAddByDrop}
                        onChange={this.onChange}
                        settings={this.state.settings}
                        ref={this.dashKitRef}
                        overlayControls={controls}
                    />
                </DemoRow>
            </Demo>
        );
    }

    _onDragStart: DragEventHandler<HTMLDivElement> = (e) => {
        e.dataTransfer.setData('text/plain', '');
    };

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
            lastAction: `Редактировать виджет (id = '${id}'): ${new Date().toISOString()}`,
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
            lastAction: `Изменился config или itemsStateAndParams: ${new Date().toISOString()}`,
        });

        if (config) {
            this.setState({config});
        }
        if (itemsStateAndParams) {
            this.setState({itemsStateAndParams});
        }
    };

    private toggleCustomMenu = () => {
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
        this.setState({showCustomMenu: !showCustomMenu});
    };

    private onAddByDrop = (layout: WidgetLayout[]) => {
        const config = DashKit.setItem(
            {
                item: {
                    data: {
                        text: `addItem rand-${makeid(4)}`,
                    },
                    namespace: 'default',
                    type: 'text',
                },
                config: this.state.config,
            },
            layout,
        );
        this.setState({config});
        this.setState({
            lastAction: `Изменился config: ${new Date().toISOString()}`,
        });
    };
}
