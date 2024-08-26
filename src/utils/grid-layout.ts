import gridLayout, {Layout} from 'react-grid-layout';

import type {CompactType} from '../';

const {utils} = gridLayout as any;

export const compact = (layout: Layout[], compactType: CompactType, cols: number): Layout[] => {
    if (compactType === 'horizontal-nowrap') {
        compactType = 'horizontal';
    }

    return utils.compact(layout, compactType, cols);
};

export const bottom = (layout: Layout[]): number => {
    return utils.bottom(layout);
};
