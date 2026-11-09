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

type MobileLayoutProps = {'data-dashkit-engine'?: string};

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
    _memoContainers = this.context.config.containers;
    _memoItems = this.context.configItems;
    _memoForwardedPluginRef = new Map<string, (refObject: PluginRef) => void>();
    _memoAdjustWidgetLayout: Record<string, (props: {needSetDefault?: boolean}) => void> = {};

    state: MobileLayoutState = {
        itemsWithActiveAutoheight: {},
    };

    private _pluginsRefs = new Map<string, PluginRef>();

    componentDidUpdate() {
        const itemIds = new Set(this.context.configItems.map(({id}) => id));
        for (const id of this._memoForwardedPluginRef.keys()) {
            if (!itemIds.has(id)) {
                this._memoForwardedPluginRef.delete(id);
                this._pluginsRefs.delete(id);
                delete this._memoAdjustWidgetLayout[id];
            }
        }
    }

    componentWillUnmount() {
        this._memoForwardedPluginRef.clear();
        this._pluginsRefs.clear();
        this._memoAdjustWidgetLayout = {};
    }

    render() {
        const {
            config,
            layout,
            groups = [{id: DEFAULT_GROUP}],
            context,
            editMode,
            configItems,
        } = this.context;

        const configItemsById = Object.fromEntries(configItems.map((item) => [item.id, item]));

        const sortedItems = this.getSortedLayoutItems();

        return (
            <div
                className={b()}
                data-dashkit-engine={this.props['data-dashkit-engine'] || 'legacy'}
            >
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
                                    item={configItemsById[item.id]}
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

    get pluginsRefs(): PluginRef[] {
        return this.context.configItems.map(({id}) => this._pluginsRefs.get(id) ?? null);
    }

    getSortedLayoutItems() {
        const nested = this.context.config.containers?.length || this._memoContainers?.length;
        if (
            this.sortedLayoutItems &&
            this.context.layout === this._memoLayout &&
            this.context.configItems === this._memoItems &&
            (!nested || this.context.config.containers === this._memoContainers)
        ) {
            return this.sortedLayoutItems;
        }

        this._memoLayout = this.context.layout;
        this._memoContainers = this.context.config.containers;
        this._memoItems = this.context.configItems;

        const hasOrderId = Boolean(this.context.configItems.find((item) => item.orderId));

        this.sortedLayoutItems = groupBy(
            getSortedConfigItems(this.context.config, this.context.configItems, hasOrderId),
            (item) => item.parent || DEFAULT_GROUP,
        );

        return this.sortedLayoutItems;
    }

    getMemoForwardRefCallback(id: string) {
        let callback = this._memoForwardedPluginRef.get(id);
        if (!callback) {
            callback = (pluginRef: PluginRef) => {
                if (pluginRef) {
                    this._pluginsRefs.set(id, pluginRef);
                } else {
                    this._pluginsRefs.delete(id);
                }
            };
            this._memoForwardedPluginRef.set(id, callback);
        }

        return callback;
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
