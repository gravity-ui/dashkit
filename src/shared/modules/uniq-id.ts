import Hashids from 'hashids';
import type {Config} from '../types';

import {isItemWithGroup, isItemWithTabs} from './helpers';

export function extractIdsFromConfig(config: Config): string[] {
    const ids: string[] = [];

    const items = config.items || [];
    const connections = config.connections || [];
    const layout = config.layout || [];

    items.forEach((item) => {
        ids.push(item.id);
        if (isItemWithTabs(item)) {
            item.data.tabs.forEach((tabItem) => ids.push(tabItem.id));
        }
        if (isItemWithGroup(item)) {
            item.data.group.forEach((groupItem) => ids.push(groupItem.id));
        }
    });
    connections.forEach(({from, to}) => ids.push(from, to));
    layout.forEach(({i}) => ids.push(i));

    return Array.from(new Set(ids));
}

type GenerateUniqIdArgs = {
    salt: Config['salt'];
    counter: Config['counter'];
    ids: string[];
};

export function generateUniqId({salt, counter, ids}: GenerateUniqIdArgs) {
    let newCounter = counter;
    let uniqId: string | null = null;

    const idsSet = new Set(ids);
    const hashids = new Hashids(salt);

    while (uniqId === null) {
        const id = hashids.encode(++newCounter);
        if (!idsSet.has(id)) {
            uniqId = id;
        }
    }

    return {counter: newCounter, id: uniqId};
}
