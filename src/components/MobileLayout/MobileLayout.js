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

    _memoForwardedPluginRef = [];

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
        if (this.sortedLayoutItems) {
            return this.sortedLayoutItems;
        }

        const hasOrderId = Boolean(this.context.config.items.find((item) => item.orderId));

        return getSortedConfigItems(this.context.config, hasOrderId);
    }

    getMemoForwardRefCallback = (refIndex) => {
        if (!this._memoForwardedPluginRef[refIndex]) {
            this._memoForwardedPluginRef[refIndex] = (pluginRef) => {
                this.pluginsRefs[refIndex] = pluginRef;
            };
        }

        return this._memoForwardedPluginRef[refIndex];
    };

    adjustWidgetLayout = ({widgetId, needSetDefault}) => {
        const correspondedLayoutItemIndex = this.getSortedLayoutItems().findIndex(
            (layoutItem) => layoutItem.i === widgetId,
        );

        if (needSetDefault) {
            const indexesOfItemsWithActiveAutoheight = {
                ...this.state.indexesOfItemsWithActiveAutoheight,
            };
            delete indexesOfItemsWithActiveAutoheight[correspondedLayoutItemIndex];

            this.setState({indexesOfItemsWithActiveAutoheight});
        } else {
            this.setState({
                indexesOfItemsWithActiveAutoheight: Object.assign(
                    {},
                    this.state.indexesOfItemsWithActiveAutoheight,
                    {[correspondedLayoutItemIndex]: true},
                ),
            });
        }
    };

    onMountChange = (isMounted) => {
        if (isMounted) {
            this._inited = true;

            this.context.onItemMountChange?.(this.props.item, {
                isAsync: this._isAsyncItem,
                isMounted: isMounted,
            });

            if (!this._isAsyncItem) {
                this.context.onItemRender?.(this.props.item);
            }
        } else {
            this.context.onItemMountChange?.(this.props.item, {
                isAsync: this._isAsyncItem,
                isMounted: isMounted,
            });
        }
    };

    onBeforeLoad = () => {
        this._isAsyncItem = true;

        return this.onLoad;
    };

    onLoad = () => {
        this.context.onItemRender?.(this.props.item);
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
                                adjustWidgetLayout={this.adjustWidgetLayout}
                                forwardedPluginRef={this.getMemoForwardRefCallback(index)}
                                onMountChange={this.onMountChange}
                                onBeforeLoad={this.onBeforeLoad}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }
}
