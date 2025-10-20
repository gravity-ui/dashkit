import type {ConfigItem, ConfigLayout} from '../../shared';
import {DashKitProps} from '../DashKit';

const sortByOrderComparator = (prev: ConfigItem, next: ConfigItem, fieldName: keyof ConfigItem) => {
    const prevOrderId = prev[fieldName];
    const nextOrderId = next[fieldName];

    if (prevOrderId === undefined) {
        return 1;
    }
    if (nextOrderId === undefined) {
        return -1;
    }
    if (prevOrderId > nextOrderId) {
        return 1;
    } else if (prevOrderId < nextOrderId) {
        return -1;
    }
    return 0;
};

const getWidgetsSortComparator = (hasOrderId: boolean) => {
    return hasOrderId
        ? (prev: ConfigItem, next: ConfigItem) => sortByOrderComparator(prev, next, 'orderId')
        : (prev: ConfigLayout, next: ConfigLayout) =>
              prev.y === next.y ? prev.x - next.x : prev.y - next.y;
};

export const getSortedConfigItems = (
    config: DashKitProps['config'],
    configItems: ConfigItem[],
    hasOrderId: boolean,
) => {
    const sortComparator = getWidgetsSortComparator(hasOrderId);

    return configItems
        .map((item, index) => Object.assign({}, item, config.layout[index]))
        .sort(sortComparator);
};
