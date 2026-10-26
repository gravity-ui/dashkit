import type {LayoutStateAdapter} from '../../hocs/withContext';
import {convertEnrichedLayoutToConfigLayout} from '../../utils/enrichLayoutWithDefaults';

export const gridStackLayoutAdapter: LayoutStateAdapter = {
    serializeLayout: (layout) =>
        convertEnrichedLayoutToConfigLayout(layout).map(({parent, ...entry}) =>
            parent ? {...entry, parent} : entry,
        ),
    optimistic: true,
};
