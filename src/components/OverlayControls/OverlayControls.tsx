import React from 'react';
import i18n from '../../i18n';
import noop from 'lodash/noop';

import {DashKitContext} from '../../context/DashKitContext';
import {
    Icon,
    DropdownMenu,
    Button,
    ButtonView,
    ButtonSize,
    IconProps,
    MenuItemProps,
    DropdownMenuItem,
} from '@gravity-ui/uikit';
import {COPIED_WIDGET_STORE_KEY, MenuItems} from '../../constants';
import {ConfigLayout, ConfigItem, PluginBase, StringParams, Config, ItemState} from '../../shared';
import type {RegisterManager} from '../../utils/register-manager';
import {DotsIcon} from '../../icons/DotsIcon';
import {CogIcon} from '../../icons/CogIcon';
import {CloseIcon} from '../../icons/CloseIcon';
import {cn} from '../../utils/cn';

import './OverlayControls.scss';
import {Settings} from '../../typings';

const b = cn('dashkit-overlay-controls');

export enum OverlayControlsPosition {
    TopRight = 'top_right',
    TopLeft = 'top_left',
    BottomRight = 'bottom_right',
    BottomLeft = 'bottom_left',
}

export interface OverlayControlItem {
    title?: string;
    icon?: IconProps['data'];
    iconSize?: number | string;
    handler?: (item: ConfigItem) => void;
    allWidgetsControls?: boolean; // флаг кастомного контрола (без кастомного виджета), которые показываются не в списке меню
    excludeWidgetsTypes?: Array<PluginBase['type']>; // массив с типами виджетов (плагинов), которые исключаем из отображения контрола по настройке allWidgetsControls
    id?: string; // id дефолтного пункта меню для возможноти использования дефолтного action в кастомных контролах
    qa?: string;
}

export interface OverlayCustomControlItem {
    id: string;
    title?: string;
    icon?: MenuItemProps['icon'];
    iconSize?: number | string;
    handler?: (item: ConfigItem, params: StringParams, state: ItemState) => void;
    visible?: (item: ConfigItem) => boolean;
    className?: string;
    qa?: string;
}

interface OverlayControlsDefaultProps {
    position: OverlayControlsPosition;
    view: ButtonView;
    size: ButtonSize;
}

interface OverlayControlsProps extends OverlayControlsDefaultProps {
    configItem: ConfigItem;
    items?: OverlayControlItem[];
    overlayControls?: Record<string, OverlayControlItem[]>;
}

type DashKitCtx = React.Context<{
    registerManager: RegisterManager;
    itemsParams: Record<string, StringParams>;
    itemsState: Record<string, ItemState>;
    editItem: (item: ConfigItem) => void;
    removeItem: (id: string) => void;
    config: Config;
}>;

const DEFAULT_DROPDOWN_MENU = [MenuItems.Copy, MenuItems.Delete];

class OverlayControls extends React.Component<OverlayControlsProps> {
    static contextType = DashKitContext;
    static defaultProps: OverlayControlsDefaultProps = {
        position: OverlayControlsPosition.TopRight,
        view: 'normal',
        size: 'm',
    };
    context!: React.ContextType<DashKitCtx>;
    render() {
        const {items = [], position} = this.props;
        const hasCustomControlsWithWidgets = items.length > 0;

        const controls = hasCustomControlsWithWidgets
            ? this.getCustomControlsWithWidgets()
            : this.renderControls();

        return <div className={b({position})}>{controls}</div>;
    }
    private renderControlsItem = (item: OverlayControlItem, index: number, length: number) => {
        const {view, size} = this.props;
        const {title, handler, icon, iconSize, qa} = item;

        const onItemClickHandler = typeof handler === 'function' ? handler : noop;
        return (
            <Button
                key={index}
                view={view}
                size={size}
                title={title}
                pin={this.getControlItemPinStyle(index, length)}
                onClick={() => onItemClickHandler(this.props.configItem)}
                qa={qa}
            >
                <Icon data={icon || CogIcon} size={icon ? iconSize : 24} />
            </Button>
        );
    };
    private getDropDownMenuItemConfig(
        menuName: string,
        isDefaultMenu?: boolean,
    ): DropdownMenuItem | null {
        switch (menuName) {
            case MenuItems.Copy: {
                return {
                    action: this.onCopyItem,
                    text: i18n('label_copy'),
                    qa: 'dashkit-overlay-control-default-menu-copy',
                };
            }
            case MenuItems.Delete: {
                return {
                    action: this.onRemoveItem,
                    text: i18n('label_delete'),
                    qa: 'dashkit-overlay-control-default-menu-delete',
                };
            }
            case MenuItems.Settings: {
                // для дефолтного состояния меню нет настройки settings, а для кастомного можно использовать дефолтный action и text
                if (isDefaultMenu) {
                    return null;
                }
                return {
                    action: this.onEditItem,
                    text: i18n('label_settings'),
                    qa: 'dashkit-overlay-control-menu-settings',
                };
            }
        }
        return null;
    }
    private renderControls() {
        const {view, size} = this.props;

        const customLeftControls = this.getCustomLeftOverlayControls();
        const hasCustomOverlayLeftControls = Boolean(customLeftControls.length);
        const defaultControl = (
            <Button
                view={view}
                size={size}
                title={i18n('label_settings')}
                pin="round-brick"
                onClick={this.onEditItem}
                qa="dashkit-overlay-control-settings"
            >
                <Icon data={CogIcon} size="24" />
            </Button>
        );
        const controls = hasCustomOverlayLeftControls
            ? customLeftControls.map(
                  (item: OverlayControlItem, index: number, items: OverlayControlItem[]) =>
                      this.renderControlsItem(item, index, items.length + 1),
              )
            : defaultControl;

        const menu = this.renderMenu();

        return (
            <div
                className={b('default-controls', {
                    'with-custom-left': hasCustomOverlayLeftControls,
                })}
            >
                {controls}
                {menu}
            </div>
        );
    }
    private renderMenu() {
        const {view, size} = this.props;
        const {registerManager} = this.context;
        const withMenu =
            Array.isArray(registerManager.settings.menu) && registerManager.settings.menu.length;

        return (
            <React.Fragment>
                {withMenu ? (
                    this.renderDropdownMenu()
                ) : (
                    <Button
                        view={view}
                        size={size}
                        title={i18n('label_delete')}
                        pin="brick-round"
                        onClick={this.onRemoveItem}
                        qa="dashkit-overlay-control-menu"
                    >
                        <Icon data={CloseIcon} size="12" />
                    </Button>
                )}
            </React.Fragment>
        );
    }
    private isDefaultMenu(menu: Settings['menu']) {
        return menu?.every((item) =>
            (Object.values(MenuItems) as Array<string>).includes(String(item)),
        );
    }
    private renderDropdownMenu() {
        const {view, size} = this.props;
        const {registerManager, itemsParams, itemsState} = this.context;

        const configItem = this.props.configItem;
        const itemParams = itemsParams[configItem.id];
        const itemState = itemsState[configItem.id];

        let menu = registerManager.settings.menu as any;
        if (!menu.length) {
            menu = DEFAULT_DROPDOWN_MENU;
        }

        const isDefaultMenu = this.isDefaultMenu(menu);

        let items = isDefaultMenu
            ? (menu || []).map((name: string) => this.getDropDownMenuItemConfig(name, true))
            : menu.map((item: OverlayCustomControlItem) => {
                  if (typeof item === 'string') {
                      return null;
                  }
                  // custom menu dropdown item filter
                  if (item.visible && !item.visible(configItem)) {
                      return null;
                  }

                  const itemHandler = item.handler;

                  const itemAction =
                      typeof itemHandler === 'function'
                          ? () => itemHandler(configItem, itemParams, itemState)
                          : this.getDropDownMenuItemConfig(item.id)?.action || (() => {});

                  return {
                      text: item.title || i18n(item.id),
                      icon: item.icon,
                      action: itemAction,
                      className: item.className,
                      qa: item.qa,
                  };
              });
        items = items.filter(Boolean);

        return (
            <DropdownMenu
                items={items}
                switcher={
                    <Button
                        view={view}
                        size={size}
                        pin="brick-round"
                        qa="dashkit-overlay-control-menu"
                    >
                        <Icon data={DotsIcon} size="16" />
                    </Button>
                }
            />
        );
    }
    private getCustomLeftOverlayControls = () => {
        // выбираем только items-ы у которых проставлено поле `allWidgetsControls:true`
        // те контролы, которые будут показываться слева от меню
        let controls: OverlayControlItem[] = [];
        for (const controlItem of Object.values(this.props.overlayControls || {})) {
            controls = controls.concat(
                (
                    (controlItem as OverlayControlItem[]).filter((item) => {
                        // если тип виджета-плагина в списке исключаемых, то не показываем такой контрол
                        if (item.excludeWidgetsTypes?.includes(this.props.configItem.type)) {
                            return false;
                        }
                        return item.allWidgetsControls;
                    }) || []
                ).map((item) => {
                    if (!item?.id) {
                        return item;
                    }

                    const defaultHandler = (this.getDropDownMenuItemConfig(item.id)?.action ||
                        (() => {})) as unknown as OverlayControlItem['handler'];
                    return {
                        ...item,
                        handler: typeof item.handler === 'function' ? item.handler : defaultHandler,
                    };
                }),
            );
        }
        return controls;
    };
    private onCopyItem = () => {
        const correspondedItemLayout = this.context.config.layout.find((item: ConfigLayout) => {
            return item.i === this.props.configItem.id;
        });

        const options = {
            timestamp: Date.now(),
            data: this.props.configItem.data,
            type: this.props.configItem.type,
            defaults: this.props.configItem.defaults,
            namespace: this.props.configItem.namespace,
            layout: {
                w: correspondedItemLayout!.w,
                h: correspondedItemLayout!.h,
            },
        };

        localStorage.setItem(COPIED_WIDGET_STORE_KEY, JSON.stringify(options));
    };
    private onEditItem = () => {
        this.context.editItem(this.props.configItem);
    };
    private onRemoveItem = () => {
        const {id} = this.props.configItem;
        this.context.removeItem(id);
    };
    private getControlItemPinStyle(index: number, itemsLength: number) {
        const isOnlyOneItem = itemsLength === 1;
        const isFirstItem = index === 0;
        const isLastItem = index === itemsLength - 1;

        if (isOnlyOneItem) {
            return 'round-round';
        }

        if (isFirstItem) {
            return 'round-brick';
        }

        if (isLastItem) {
            return 'brick-round';
        }

        return 'brick-brick';
    }
    private getCustomControlsWithWidgets() {
        // Добавляем контрол удаления виджета по умолчанию
        const deleteControl = {
            title: i18n('label_delete'),
            icon: CloseIcon,
            iconSize: 12,
            handler: this.onRemoveItem,
        };
        const {items = []} = this.props;
        const customOverlayControls = [...items, deleteControl];
        return customOverlayControls.map(
            (item: OverlayControlItem, index: number, controlItems: OverlayControlItem[]) =>
                this.renderControlsItem(item, index, controlItems.length),
        );
    }
}

export default OverlayControls;
