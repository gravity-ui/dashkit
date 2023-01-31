import React from 'react';
import {Button, Icon} from '@gravity-ui/uikit';
import {DashKit, DashKitProps, MenuItems, ConfigItem} from '../../..';
import {TickIcon} from '../../../icons/TickIcon';
import {CogIcon} from '../../../icons/CogIcon';
import {CopyIcon} from '../../../icons/CopyIcon';
import {DeleteIcon} from '../../../icons/DeleteIcon';
import {WarningIcon} from '../../../icons/WarningIcon';
import i18n from '../../../i18n';
import {getConfig, makeid, titleId} from './utils';
import Demo from './Demo';

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
    };

    private dashKitRef = React.createRef<DashKit>();

    componentDidMount() {
        this.toggleCustomMenu();
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
                <Demo.Row title="Внешнее взаимодействие">
                    <Button
                        view="normal"
                        size="m"
                        onClick={() => this.setState({editMode: !editMode})}
                    >
                        {editMode ? 'Отключить редактирование' : 'Включить редактирование'}
                    </Button>
                    &nbsp;&nbsp;
                    <Button view="normal" size="m" onClick={this.toggleCustomMenu}>
                        {this.state.showCustomMenu
                            ? 'Отключить кастомное меню'
                            : 'Включить кастомное меню'}
                    </Button>
                    &nbsp;&nbsp;
                    <Button view="normal" size="m" onClick={this.addText}>
                        {'Добавить текст'}
                    </Button>
                    &nbsp;&nbsp;
                    <Button view="normal" size="m" onClick={this.addTitle}>
                        {'Добавить тайтл'}
                    </Button>
                    &nbsp;&nbsp;
                    <Button view="normal" size="m" onClick={this.changeTitle}>
                        {'Поменять текст заголовка'}
                    </Button>
                    &nbsp;&nbsp;
                    <Button view="normal" size="m" onClick={this.removeTitle}>
                        {'Удалить заголовок'}
                    </Button>
                    &nbsp;&nbsp;
                    <Button view="action" size="m" onClick={this.getItemsMeta}>
                        {'ref.getItemsMeta'}
                    </Button>
                </Demo.Row>
                <Demo.Row title="Изменения из DashKit">{this.state.lastAction}</Demo.Row>
                <Demo.Row title="Компонент">
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
                </Demo.Row>
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

    private changeTitle = () => {
        if (!this.isTitleInConfig()) {
            return;
        }
        const config = DashKit.setItem({
            item: {
                id: titleId,
                data: {
                    size: 'm',
                    text: `Заголовок rand-${makeid(4)}`,
                    showInTOC: true,
                },
                namespace: 'default',
                type: 'title',
            },
            config: this.state.config,
        });
        this.setState({config});
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

        this.setState({config, itemsStateAndParams});
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
        this.setState({config});
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
        this.setState({config});
    };

    private getItemsMeta = async () => {
        // Получаем meta из плагинов, если у них есть публичный метод getMeta(),
        // который вернет Promise, таким образом, можно получить информацию из экземпляра плагина
        if (this.dashKitRef.current) {
            const itemsMetas = await Promise.all(this.dashKitRef.current.getItemsMeta());
            // В плагине Title и Text нет такого метода
            console.log(itemsMetas);
        }
    };

    private isTitleInConfig() {
        return Boolean(this.state.config.items.find((item) => item.id === titleId));
    }

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
}
