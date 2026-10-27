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
    const layoutById = new Map(config.layout.map((entry) => [entry.i, entry]));

    const containers = config.containers;
    if (containers?.length) {
        const entries = configItems.map((item) => ({
            ...item,
            ...config.layout.find(({i}) => i === item.id),
        }));
        if (hasOrderId) {
            return entries.sort((a, b) => sortByOrderComparator(a, b, 'orderId'));
        }
        const result: typeof entries = [];
        const visit = (containerId?: string) => {
            const children = [
                ...entries
                    .filter((item) => item.containerId === containerId)
                    .map((item) => ({id: item.id, x: item.x || 0, y: item.y || 0, item})),
                ...containers
                    .filter((item) => item.containerId === containerId)
                    .map((item) => ({...item, item: undefined})),
            ].sort((a, b) => a.y - b.y || a.x - b.x);
            children.forEach((child) => {
                if (child.item) {
                    result.push(child.item);
                } else {
                    visit(child.id);
                }
            });
        };
        visit();
        return result;
    }

    return configItems
        .map((item) => Object.assign({}, item, layoutById.get(item.id)))
        .sort(sortComparator);
};
