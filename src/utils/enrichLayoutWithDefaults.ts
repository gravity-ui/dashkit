import type {WidgetLayout} from 'src/typings/common';

import {type Config, type ConfigLayout, getAllConfigItems} from '../shared';

import type {RegisterManager} from './register-manager';

export function enrichLayoutWithDefaults(config: Config, registerManager: RegisterManager) {
    const configItems = getAllConfigItems(config);

    return config.layout.reduce<ConfigLayout[]>((acc, itemLayout, i) => {
        const item = configItems[i];
        const foundItem =
            item && item.id === itemLayout.i
                ? item
                : configItems.find((configItem) => configItem.id === itemLayout.i);

        if (foundItem) {
            acc.push({
                ...registerManager.getItem(foundItem.type).defaultLayout,
                ...itemLayout,
            });
        }

        return acc;
    }, []);
}

export function convertEnrichedLayoutToConfigLayout(layout: WidgetLayout[]): ConfigLayout[] {
    return layout.map((i) => ({
        i: i.i,
        h: i.h,
        w: i.w,
        x: i.x,
        y: i.y,
        parent: i.parent,
    }));
}
