import type {WidgetLayout} from 'src/typings/common';

import {type Config, type ConfigLayout, getAllConfigItems} from '../shared';
import {RegisterManager} from '../utils';

/**
 * Enriches layout items with default values from plugin definitions.
 * This merges config.layout with registerManager's defaultLayout for each item type.
 * Used to ensure layout items have all required fields even if not explicitly set in config.
 */
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
