import {DEFAULT_GROUP} from '../constants';
import type {ConfigLayout} from '../shared/types';

export const resolveLayoutGroup = (item: ConfigLayout) => {
    if (!item.parent) {
        return DEFAULT_GROUP;
    }

    return item.parent;
};

export const isDefaultLayoutGroup = (item: ConfigLayout) => {
    return item.parent === DEFAULT_GROUP || item.parent === undefined;
};
