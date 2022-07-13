import React from 'react';
import block from 'bem-cn-lite';

import Item from '../Item/Item';
import {DashKitContext} from '../../context/DashKitContext';
import {getSortedConfigItems} from './helpers';

import './MobileLayout.scss';

const b = block('dashkit-mobile-layout');

export default class MobileLayout extends React.PureComponent {
    static contextType = DashKitContext;

    pluginsRefs = [];

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

    render() {
        const {config, getLayout} = this.context;

        this.pluginsRefs.length = config.items.length;

        const hasOrderId = Boolean(config.items.find((item) => item.orderId));
        const sortedItems = getSortedConfigItems(config, hasOrderId);

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
                                layout={getLayout()}
                                shouldItemUpdate={false}
                                adjustWidgetLayout={this.adjustWidgetLayout.bind(this, index)}
                                forwardedPluginRef={(pluginRef) => {
                                    this.pluginsRefs[index] = pluginRef;
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }
}
