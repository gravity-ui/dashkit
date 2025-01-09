import React from 'react';

import {Ellipsis, Gear, Xmark} from '@gravity-ui/icons';
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

import {
    COPIED_WIDGET_STORE_KEY,
    DRAGGABLE_CANCEL_CLASS_NAME,
    MenuItems,
    OVERLAY_CONTROLS_CLASS_NAME,
    OVERLAY_ICON_SIZE,
} from '../../constants';
import {DashkitOvelayControlsContext, OverlayControlsCtxShape} from '../../context';
import {i18n} from '../../i18n';
import {
    type ConfigItem,
    type ItemParams,
    type ItemState,
    type PluginBase,
    isItemWithTabs,
    resolveItemInnerId,
} from '../../shared';
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
    visible?: (item: ConfigItem) => boolean;
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
    handler?: (item: ConfigItem, params: ItemParams, state: ItemState) => void;
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
    onItemClick?: () => void | null;
}

type PreparedCopyItemOptionsArg = Pick<ConfigItem, 'data' | 'type' | 'defaults' | 'namespace'> & {
    timestamp: number;
    layout: {
        w: number;
        h: number;
    };
    targetId?: string;
    targetInnerId?: string;
};

export type PreparedCopyItemOptions<C extends object = {}> = PreparedCopyItemOptionsArg & {
    copyContext?: C;
};

type OverlayControlsCtx = React.Context<OverlayControlsCtxShape>;

const DEFAULT_DROPDOWN_MENU = [MenuItems.Copy, MenuItems.Delete];

class OverlayControls extends React.Component<OverlayControlsProps> {
    static contextType = DashkitOvelayControlsContext;
    static defaultProps: OverlayControlsDefaultProps = {
        position: OverlayControlsPosition.TopRight,
        view: 'flat',
        size: 'm',
    };
    context!: React.ContextType<OverlayControlsCtx>;
    render() {
        const {position} = this.props;
        const items = this.getItems();
        const hasCustomControlsWithWidgets = items.length > 0;

        const controls = hasCustomControlsWithWidgets
            ? this.getCustomControlsWithWidgets()
            : this.renderControls();

        return <div className={b({position}, [DRAGGABLE_CANCEL_CLASS_NAME])}>{controls}</div>;
    }

    private getItems = () => {
        const {overlayControls} = this.context;
        const {configItem} = this.props;

        return (overlayControls && overlayControls[configItem.type]) || [];
    };

    private renderControlsItem = (item: OverlayControlItem, index: number, length: number) => {
        const {view, size, onItemClick} = this.props;
        const {title, handler, icon, iconSize, qa} = item;

        const onItemClickHandler = typeof handler === 'function' ? handler : noop;
        return (
            <Button
                key={`control_${index}`}
                view={view}
                size={size}
                title={title}
                pin={this.getControlItemPinStyle(index, length)}
                onClick={() => {
                    onItemClickHandler(this.props.configItem);
                    onItemClick?.();
                }}
                qa={qa}
            >
                <Icon data={icon || Gear} size={icon ? iconSize : OVERLAY_ICON_SIZE} />
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

    private getDefaultControls = () => {
        const {view, size} = this.props;

        if (this.context.overlayControls === null) {
            return null;
        }

        return (
            <Button
                key={'control_default'}
                view={view}
                size={size}
                title={i18n('label_settings')}
                pin="round-brick"
                onClick={this.onEditItem}
                qa="dashkit-overlay-control-settings"
            >
                <Icon data={Gear} size={OVERLAY_ICON_SIZE} />
            </Button>
        );
    };

    private renderControls() {
        const customLeftControls = this.getCustomLeftOverlayControls();
        const hasCustomOverlayLeftControls = Boolean(customLeftControls.length);

        const controls = hasCustomOverlayLeftControls
            ? customLeftControls.map(
                  (item: OverlayControlItem, index: number, items: OverlayControlItem[]) =>
                      this.renderControlsItem(item, index, items.length + 1),
              )
            : this.getDefaultControls();

        const menu = this.renderMenu(controls === null);

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
    private renderMenu(isOnlyOneItem: boolean) {
        const {view, size} = this.props;

        const dropdown = this.renderDropdownMenu(isOnlyOneItem);

        if (dropdown) {
            return dropdown;
        }

        return (
            <Button
                key={'delete-control'}
                view={view}
                size={size}
                title={i18n('label_delete')}
                pin={isOnlyOneItem ? 'round-round' : 'brick-round'}
                onClick={this.onRemoveItem}
                qa="dashkit-overlay-control-menu"
            >
                <Icon data={Xmark} size={OVERLAY_ICON_SIZE} />
            </Button>
        );
    }

    private isDefaultMenu(menu: Settings['menu']) {
        return menu?.every((item) =>
            (Object.values(MenuItems) as Array<string>).includes(String(item)),
        );
    }
    private renderDropdownMenu(isOnlyOneItem: boolean) {
        const {view, size, onItemClick} = this.props;
        const {menu: contextMenu, itemsParams, itemsState} = this.context;

        const configItem = this.props.configItem;
        const itemParams = itemsParams[configItem.id];
        const itemState = itemsState?.[configItem.id] || {};

        const menu = contextMenu && contextMenu.length > 0 ? contextMenu : DEFAULT_DROPDOWN_MENU;

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
                          ? () => {
                                const result = itemHandler(configItem, itemParams, itemState);
                                onItemClick?.();
                                return result;
                            }
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

        if (items.length === 0) {
            return null;
        }

        return (
            <DropdownMenu
                key={'controls_dropdown'}
                items={items}
                renderSwitcher={(props) => (
                    <Button
                        {...props}
                        view={view}
                        size={size}
                        pin={isOnlyOneItem ? 'round-round' : 'brick-round'}
                        extraProps={{'aria-label': i18n('label_more-options')}}
                        qa="dashkit-overlay-control-menu"
                    >
                        <Icon data={Ellipsis} size={OVERLAY_ICON_SIZE} />
                    </Button>
                )}
                popupProps={{
                    contentClassName: DRAGGABLE_CANCEL_CLASS_NAME,
                }}
            />
        );
    }
    private getCustomLeftOverlayControls = () => {
        // выбираем только items-ы у которых проставлено поле `allWidgetsControls:true`
        // те контролы, которые будут показываться слева от меню
        let controls: OverlayControlItem[] = [];
        const {onItemClick} = this.props;

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
                                ? (...args) => {
                                      const result = item.handler?.(...args);
                                      onItemClick?.();
                                      return result;
                                  }
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

        let targetInnerId;

        if (isItemWithTabs(this.props.configItem)) {
            targetInnerId = resolveItemInnerId({
                item: this.props.configItem,
                itemsStateAndParams: this.context.itemsStateAndParams,
            });
        }

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
            targetId: this.props.configItem.id,
            targetInnerId,
        };

        if (this.context.context?.getPreparedCopyItemOptions) {
            console.warn?.(
                '`context.getPreparedCopyItemOptions` is deprecated. Please use `getPreparedCopyItemOptions` prop instead',
            );
        }

        const getPreparedCopyItemOptions =
            this.context?.getPreparedCopyItemOptions ??
            this.context.context?.getPreparedCopyItemOptions;

        if (typeof getPreparedCopyItemOptions === 'function') {
            options = getPreparedCopyItemOptions(options);
        }

        try {
            localStorage.setItem(COPIED_WIDGET_STORE_KEY, JSON.stringify(options));
            this.context.onCopyFulfill?.(null, options);
        } catch (e) {
            const error = e instanceof Error ? e : new Error('Unknown error while copying item');
            this.context.onCopyFulfill?.(error);
        }
        // https://stackoverflow.com/questions/35865481/storage-event-not-firing
        window.dispatchEvent(new Event('storage'));
        this.props.onItemClick?.();
    };
    private onEditItem = () => {
        this.context.editItem?.(this.props.configItem);
        this.props.onItemClick?.();
    };
    private onRemoveItem = () => {
        const {id} = this.props.configItem;
        this.context.removeItem(id);
        this.props.onItemClick?.();
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
        const items = this.getItems();

        const result = items.map(
            (item: OverlayControlItem, index: number, controlItems: OverlayControlItem[]) =>
                this.renderControlsItem(item, index, controlItems.length),
        );
        const isOnlyOneItem = items.length === 0;

        // Добавляем контрол удаления или меню виджета по умолчанию
        result.push(this.renderMenu(isOnlyOneItem));

        return result;
    }
}

export default OverlayControls;
