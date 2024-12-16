import React from 'react';

import groupBy from 'lodash/groupBy';

import {DEFAULT_GROUP} from '../../constants';
import {DashKitContext} from '../../context';
import {cn} from '../../utils/cn';
import Item from '../Item/Item';

import {getSortedConfigItems} from './helpers';

import './MobileLayout.scss';

const b = cn('dashkit-mobile-layout');

type MobileLayoutProps = {};

type MobileLayoutState = {
    indexesOfItemsWithActiveAutoheight: Record<string, boolean>;
};

type PlugibRefObject = React.RefObject<any>;

export default class MobileLayout extends React.PureComponent<
    MobileLayoutProps,
    MobileLayoutState
> {
    static contextType = DashKitContext;
    context!: React.ContextType<typeof DashKitContext>;

    pluginsRefs: PlugibRefObject[] = [];
    sortedLayoutItems: Record<string, ReturnType<typeof getSortedConfigItems>> | null = null;

    _memoLayout = this.context.layout;
    _memoForwardedPluginRef: Array<(refObject: PlugibRefObject) => void> = [];
    _memoAdjustWidgetLayout: Array<(props: {needSetDefault: boolean}) => void> = [];

    state: MobileLayoutState = {
        indexesOfItemsWithActiveAutoheight: {},
    };

    render() {
        const {config, layout, groups = [{id: DEFAULT_GROUP}], context, editMode} = this.context;

        this.pluginsRefs.length = config.items.length;

        const sortedItems = this.getSortedLayoutItems();

        return (
            <div className={b()}>
                {groups.map((group) => {
                    const groupId = group.id || DEFAULT_GROUP;
                    const items = sortedItems[groupId];

                    const children = items.map((item, index) => {
                        const isItemWithActiveAutoheight =
                            index in this.state.indexesOfItemsWithActiveAutoheight;

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
                                    adjustWidgetLayout={this.getMemoAdjustWidgetLayout(index)}
                                    forwardedPluginRef={this.getMemoForwardRefCallback(index)}
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

    getSortedLayoutItems() {
        if (this.sortedLayoutItems && this.context.layout === this._memoLayout) {
            return this.sortedLayoutItems;
        }

        this._memoLayout = this.context.layout;

        const hasOrderId = Boolean(this.context.config.items.find((item) => item.orderId));

        this.sortedLayoutItems = groupBy(
            getSortedConfigItems(this.context.config, hasOrderId),
            (item) => item.parent || DEFAULT_GROUP,
        );

        return this.sortedLayoutItems;
    }

    getMemoForwardRefCallback(refIndex: number) {
        if (!this._memoForwardedPluginRef[refIndex]) {
            this._memoForwardedPluginRef[refIndex] = (pluginRef: PlugibRefObject) => {
                this.pluginsRefs[refIndex] = pluginRef;
            };
        }

        return this._memoForwardedPluginRef[refIndex];
    }

    adjustWidgetLayout(index: number, {needSetDefault}: {needSetDefault: boolean}) {
        if (needSetDefault) {
            const indexesOfItemsWithActiveAutoheight = {
                ...this.state.indexesOfItemsWithActiveAutoheight,
            };

            delete indexesOfItemsWithActiveAutoheight[index];

            this.setState({indexesOfItemsWithActiveAutoheight});
        } else {
            this.setState({
                indexesOfItemsWithActiveAutoheight: Object.assign(
                    {},
                    this.state.indexesOfItemsWithActiveAutoheight,
                    {[index]: true},
                ),
            });
        }
    }

    getMemoAdjustWidgetLayout(index: number) {
        if (!this._memoAdjustWidgetLayout[index]) {
            this._memoAdjustWidgetLayout[index] = this.adjustWidgetLayout.bind(this, index);
        }

        return this._memoAdjustWidgetLayout[index];
    }
}
