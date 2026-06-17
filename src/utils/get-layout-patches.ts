import pick from 'lodash/pick';

import {CONFIG_LAYOUT_FIELDS} from '../shared';
import type {ConfigLayout} from '../shared';
import type {DashKitLayoutPatch} from '../typings';

export function getLayoutPatches(
    previousLayout: ConfigLayout[],
    nextLayout: ConfigLayout[],
): DashKitLayoutPatch[] {
    const prevById = new Map(previousLayout.map((item) => [item.i, item]));

    return nextLayout.reduce<DashKitLayoutPatch[]>((patches, nextItem) => {
        const prevItem = prevById.get(nextItem.i);
        if (!prevItem) {
            return patches;
        }

        const nextPicked = pick(nextItem, CONFIG_LAYOUT_FIELDS);
        const prevPicked = pick(prevItem, CONFIG_LAYOUT_FIELDS);

        const changed = CONFIG_LAYOUT_FIELDS.some((key) => nextPicked[key] !== prevPicked[key]);

        if (changed) {
            patches.push(nextPicked as DashKitLayoutPatch);
        }

        return patches;
    }, []);
}
