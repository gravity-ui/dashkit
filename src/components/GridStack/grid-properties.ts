import {DEFAULT_GROUP} from '../../constants/common';
import type {DashKitGroup, ReactGridLayoutProps} from '../../typings';

// Static edits and mounted grids must resolve the same geometry and inherited interactions.
export function getGridProperties(
    key: string,
    defaults: ReactGridLayoutProps,
    groups?: DashKitGroup[],
): ReactGridLayoutProps {
    const group = groups?.find(({id}) => key === `zone:${id || DEFAULT_GROUP}`);
    const properties = group?.gridProperties ? group.gridProperties({...defaults}) : defaults;
    // A partial group callback retains the legacy renderer's geometry defaults.
    return {
        ...properties,
        cols: properties.cols ?? 12,
        rowHeight: properties.rowHeight ?? 150,
        margin: properties.margin || [10, 10],
        containerPadding: properties.containerPadding || properties.margin || [10, 10],
    };
}
