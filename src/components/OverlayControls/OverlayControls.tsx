import React from 'react';

import {
    Button,
    ButtonSize,
    ButtonView,
    DropdownMenu,
    DropdownMenuItem,
    Icon,
    IconProps,
    MenuItemProps,
} from '@gravity-ui/uikit';
import noop from 'lodash/noop';

import {COPIED_WIDGET_STORE_KEY, MenuItems, OVERLAY_CONTROLS_CLASS_NAME} from '../../constants';
import {DashkitOvelayControlsContext} from '../../context/DashKitContext';
import {i18n} from '../../i18n';
import {CloseIcon} from '../../icons/CloseIcon';
import {CogIcon} from '../../icons/CogIcon';
import {DotsIcon} from '../../icons/DotsIcon';
import type {ConfigItem, ConfigLayout, ItemState, PluginBase, StringParams} from '../../shared';
import {MenuItem, Settings} from '../../typings';
import {cn} from '../../utils/cn';

import './OverlayControls.scss';

const b = cn(OVERLAY_CONTROLS_CLASS_NAME);

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
    visible?: (item: ConfigItem) => boolean;
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
}

type PreparedCopyItemOptionsArg = Pick<ConfigItem, 'data' | 'type' | 'defaults' | 'namespace'> & {
    timestamp: number;
    layout: {
        w: number;
        h: number;
    };
};

export type PreparedCopyItemOptions<C extends object = {}> = PreparedCopyItemOptionsArg & {
    copyContext?: C;
};

type DashKitCtx = React.Context<{
    overlayControls?: Record<string, OverlayControlItem[]>;
    context: Record<string, any>;
    menu: MenuItem[];
    itemsParams: Record<string, StringParams>;
    itemsState: Record<string, ItemState>;
    editItem: (item: ConfigItem) => void;
    removeItem: (id: string) => void;
    getLayoutItem: (id: string) => ConfigLayout | void;
}>;

const DEFAULT_DROPDOWN_MENU = [MenuItems.Copy, MenuItems.Delete];

class OverlayControls extends React.Component<OverlayControlsProps> {
    static contextType = DashkitOvelayControlsContext;
    static defaultProps: OverlayControlsDefaultProps = {
        position: OverlayControlsPosition.TopRight,
        view: 'flat',
        size: 'm',
    };
    context!: React.ContextType<DashKitCtx>;
    render() {
        const {position} = this.props;
        const items = this.getItems();
        const hasCustomControlsWithWidgets = items.length > 0;

        const controls = hasCustomControlsWithWidgets
            ? this.getCustomControlsWithWidgets()
            : this.renderControls();

        return <div className={b({position})}>{controls}</div>;
    }

    private getItems = () => {
        const {overlayControls} = this.context;
        const {configItem} = this.props;

        return (overlayControls && overlayControls[configItem.type]) || [];
    };

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
    private getDropDownMenuItemConfig(menuName: string, isDefaultMenu?: boolean) {
        switch (menuName) {
            case MenuItems.Copy: {
                return {
                    action: this.onCopyItem,
                    text: i18n('label_copy'),
                };
            }
            case MenuItems.Delete: {
                return {
                    action: this.onRemoveItem,
                    text: i18n('label_delete'),
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
        const {menu} = this.context;
        const withMenu = Array.isArray(menu) && menu.length;

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
        const {menu: contextMenu, itemsParams, itemsState} = this.context;

        const configItem = this.props.configItem;
        const itemParams = itemsParams[configItem.id];
        const itemState = itemsState[configItem.id];

        const menu = contextMenu?.length > 0 ? contextMenu : DEFAULT_DROPDOWN_MENU;

        const isDefaultMenu = this.isDefaultMenu(menu);

        const items: DropdownMenuItem[] = isDefaultMenu
            ? ((menu || []) as string[]).reduce<DropdownMenuItem[]>((memo, name: string) => {
                  const item = this.getDropDownMenuItemConfig(name, true);
                  if (item) {
                      memo.push(item);
                  }

                  return memo;
              }, [])
            : menu.reduce<DropdownMenuItem[]>((memo, item: MenuItem) => {
                  if (typeof item === 'string') {
                      return memo;
                  }
                  // custom menu dropdown item filter
                  if (item.visible && !item.visible(configItem)) {
                      return memo;
                  }

                  const itemHandler = item.handler;

                  const itemAction =
                      typeof itemHandler === 'function'
                          ? () => itemHandler(configItem, itemParams, itemState)
                          : this.getDropDownMenuItemConfig(item.id)?.action || (() => {});

                  memo.push({
                      // @ts-expect-error
                      text: item.title || i18n(item.id),
                      icon: item.icon,
                      action: itemAction,
                      className: item.className,
                      qa: item.qa,
                  });

                  return memo;
              }, []);

        return (
            <DropdownMenu
                items={items}
                renderSwitcher={(props) => (
                    <Button
                        {...props}
                        view={view}
                        size={size}
                        pin="brick-round"
                        qa="dashkit-overlay-control-menu"
                    >
                        <Icon data={DotsIcon} size="16" />
                    </Button>
                )}
            />
        );
    }
    private getCustomLeftOverlayControls = () => {
        // выбираем только items-ы у которых проставлено поле `allWidgetsControls:true`
        // те контролы, которые будут показываться слева от меню
        let controls: OverlayControlItem[] = [];
        for (const controlItem of Object.values(this.context.overlayControls || {})) {
            controls = controls.concat(
                (
                    (controlItem as OverlayControlItem[]).filter((item) => {
                        // если тип виджета-плагина в списке исключаемых, то не показываем такой контрол
                        if (item.excludeWidgetsTypes?.includes(this.props.configItem.type)) {
                            return false;
                        }

                        return item.visible
                            ? item.visible(this.props.configItem)
                            : item.allWidgetsControls;
                    }) || []
                ).map((item) => {
                    if (!item?.id) {
                        return item;
                    }
                    return {
                        ...item,
                        handler:
                            typeof item.handler === 'function'
                                ? item.handler
                                : this.getDropDownMenuItemConfig(item.id)?.action || (() => {}),
                    };
                }),
            );
        }
        return controls;
    };
    private onCopyItem = () => {
        const {configItem} = this.props;
        const correspondedItemLayout = this.context.getLayoutItem(configItem.id);

        let options: PreparedCopyItemOptions = {
            timestamp: Date.now(),
            data: configItem.data,
            type: configItem.type,
            defaults: configItem.defaults,
            namespace: configItem.namespace,
            layout: {
                w: correspondedItemLayout!.w,
                h: correspondedItemLayout!.h,
            },
        };

        if (typeof this.context.context?.getPreparedCopyItemOptions === 'function') {
            options = this.context.context.getPreparedCopyItemOptions(options);
        }

        localStorage.setItem(COPIED_WIDGET_STORE_KEY, JSON.stringify(options));
        // https://stackoverflow.com/questions/35865481/storage-event-not-firing
        window.dispatchEvent(new Event('storage'));
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
        const items = this.getItems();
        const customOverlayControls = [...items, deleteControl];
        return customOverlayControls.map(
            (item: OverlayControlItem, index: number, controlItems: OverlayControlItem[]) =>
                this.renderControlsItem(item, index, controlItems.length),
        );
    }
}

export default OverlayControls;
