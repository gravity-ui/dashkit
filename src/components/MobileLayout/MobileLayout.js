import React from 'react';

import {DashKitContext} from '../../context/DashKitContext';
import {cn} from '../../utils/cn';
import Item from '../Item/Item';

import {getSortedConfigItems} from './helpers';

import './MobileLayout.scss';

const b = cn('dashkit-mobile-layout');

export default class MobileLayout extends React.PureComponent {
    static contextType = DashKitContext;

    pluginsRefs = [];
    sortedLayoutItems;

    _memoLayout = this.context.layout;
    _memoForwardedPluginRef = [];
    _memoAdjustWidgetLayout = [];

    state = {
        activeTabId: null,
        indexesOfItemsWithActiveAutoheight: {},
    };

    componentDidUpdate(prevProps, prevState) {
        if (prevState.activeTabId !== this.context.config.id) {
            this.setState({
                activeTabId: this.context.config.id,
                indexesOfItemsWithActiveAutoheight: {},
            });
        }
    }

    getSortedLayoutItems() {
        if (this.sortedLayoutItems && this.context.layout === this._memoLayout) {
            return this.sortedLayoutItems;
        }

        this._memoLayout = this.context.layout;

        const hasOrderId = Boolean(this.context.config.items.find((item) => item.orderId));

        this.sortedLayoutItems = getSortedConfigItems(this.context.config, hasOrderId);

        return this.sortedLayoutItems;
    }

    getMemoForwardRefCallback = (refIndex) => {
        if (!this._memoForwardedPluginRef[refIndex]) {
            this._memoForwardedPluginRef[refIndex] = (pluginRef) => {
                this.pluginsRefs[refIndex] = pluginRef;
            };
        }

        return this._memoForwardedPluginRef[refIndex];
    };

    adjustWidgetLayout = (index, {needSetDefault}) => {
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
    };

    getMemoAdjustWidgetLayout = (index) => {
        if (!this._memoAdjustWidgetLayout[index]) {
            this._memoAdjustWidgetLayout[index] = this.adjustWidgetLayout.bind(this, index);
        }

        return this._memoAdjustWidgetLayout[index];
    };

    render() {
        const {config, layout} = this.context;

        this.pluginsRefs.length = config.items.length;

        const sortedItems = this.getSortedLayoutItems();

        return (
            <div className={b()}>
                {sortedItems.map((item, index) => {
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
                                onMountChange={this.onMountChange}
                                onItemMountChange={this.context.onItemMountChange}
                                onItemRender={this.context.onItemRender}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }
}
