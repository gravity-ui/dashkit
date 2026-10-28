import React from 'react';

import groupBy from 'lodash/groupBy';

import type {PluginRef} from 'src/typings';

import {DEFAULT_GROUP} from '../../constants';
import {DashKitContext} from '../../context';
import {cn} from '../../utils/cn';
import Item from '../Item/Item';

import {getSortedConfigItems} from './helpers';

import './MobileLayout.scss';

const b = cn('dashkit-mobile-layout');

type MobileLayoutProps = {};

type MobileLayoutState = {
    itemsWithActiveAutoheight: Record<string, boolean>;
};

export default class MobileLayout extends React.PureComponent<
    MobileLayoutProps,
    MobileLayoutState
> {
    static contextType = DashKitContext;
    context!: React.ContextType<typeof DashKitContext>;

    sortedLayoutItems: Record<string, ReturnType<typeof getSortedConfigItems>> | null = null;

    _memoLayout = this.context.layout;
    _memoConfigItems = this.context.configItems;
    _memoForwardedPluginRef = new Map<string, (refObject: PluginRef) => void>();
    _memoAdjustWidgetLayout: Record<string, (props: {needSetDefault?: boolean}) => void> = {};

    state: MobileLayoutState = {
        itemsWithActiveAutoheight: {},
    };

    private plugins = new Map<string, PluginRef>();

    render() {
        const {config, layout, groups = [{id: DEFAULT_GROUP}], context, editMode} = this.context;

        const sortedItems = this.getSortedLayoutItems();

        return (
            <div className={b()}>
                {groups.map((group) => {
                    const groupId = group.id || DEFAULT_GROUP;
                    const items = sortedItems[groupId] || [];

                    const children = items.map((item) => {
                        const isItemWithActiveAutoheight =
                            item.id in this.state.itemsWithActiveAutoheight;

                        return (
                            <div
                                className={b('item', {autoheight: isItemWithActiveAutoheight})}
                                key={item.id}
                            >
                                <Item
                                    id={item.id}
                                    item={item}
                                    layout={layout}
                                    shouldItemUpdate={false}
                                    adjustWidgetLayout={this.getMemoAdjustWidgetLayout(item.id)}
                                    forwardedPluginRef={this.getMemoForwardRefCallback(item.id)}
                                    onItemMountChange={this.context.onItemMountChange}
                                    onItemRender={this.context.onItemRender}
                                />
                            </div>
                        );
                    });

                    if (group.render) {
                        return group.render(groupId, children, {
                            isMobile: true,
                            config,
                            context,
                            editMode,
                            items,
                            layout,
                        });
                    }

                    return children;
                })}
            </div>
        );
    }

    get pluginsRefs() {
        return this.context.configItems
            .map(({id}) => this.plugins.get(id))
            .filter((ref): ref is PluginRef => ref !== undefined);
    }

    getSortedLayoutItems() {
        if (
            this.sortedLayoutItems &&
            this.context.layout === this._memoLayout &&
            this.context.configItems === this._memoConfigItems
        ) {
            return this.sortedLayoutItems;
        }

        this._memoLayout = this.context.layout;
        this._memoConfigItems = this.context.configItems;

        const hasOrderId = Boolean(this.context.configItems.find((item) => item.orderId));

        this.sortedLayoutItems = groupBy(
            getSortedConfigItems(this.context.config, this.context.configItems, hasOrderId),
            (item) => item.parent || DEFAULT_GROUP,
        );

        return this.sortedLayoutItems;
    }

    getMemoForwardRefCallback(id: string) {
        if (!this._memoForwardedPluginRef.has(id)) {
            this._memoForwardedPluginRef.set(id, (pluginRef: PluginRef) => {
                if (pluginRef) {
                    this.plugins.set(id, pluginRef);
                } else {
                    this.plugins.delete(id);
                }
            });
        }

        return this._memoForwardedPluginRef.get(id);
    }

    adjustWidgetLayout(id: string, {needSetDefault}: {needSetDefault?: boolean}) {
        if (needSetDefault) {
            const indexesOfItemsWithActiveAutoheight = {
                ...this.state.itemsWithActiveAutoheight,
            };

            delete indexesOfItemsWithActiveAutoheight[id];

            this.setState({itemsWithActiveAutoheight: indexesOfItemsWithActiveAutoheight});
        } else {
            this.setState({
                itemsWithActiveAutoheight: Object.assign({}, this.state.itemsWithActiveAutoheight, {
                    [id]: true,
                }),
            });
        }
    }

    getMemoAdjustWidgetLayout(id: string) {
        if (!this._memoAdjustWidgetLayout[id]) {
            this._memoAdjustWidgetLayout[id] = this.adjustWidgetLayout.bind(this, id);
        }

        return this._memoAdjustWidgetLayout[id];
    }
}
