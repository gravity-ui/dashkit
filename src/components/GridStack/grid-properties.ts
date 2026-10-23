import {DEFAULT_GROUP} from '../../constants/common';
import type {GridStackContainer} from '../../shared';
import type {DashKitGroup, ReactGridLayoutProps} from '../../typings';

import {getGridKey} from './document';
import {getContainerMaxRows} from './geometry';
import {requireValue} from './invariants';

// Static edits and mounted grids must resolve the same geometry and inherited interactions.
export function getGridProperties(
    key: string,
    defaults: ReactGridLayoutProps,
    groups?: DashKitGroup[],
    containers?: GridStackContainer[],
): ReactGridLayoutProps {
    if (key.startsWith('container:')) {
        const container = requireValue(
            containers?.find(({id}) => key === `container:${id}`),
            'container descriptor',
        );
        const zone = getGridProperties(
            `zone:${container.parent || DEFAULT_GROUP}`,
            defaults,
            groups,
        );
        return {
            ...defaults,
            isDraggable: zone.isDraggable,
            isResizable: zone.isResizable,
            isBounded: zone.isBounded,
            preventCollision: zone.preventCollision,
            resizeHandles: zone.resizeHandles,
            resizeHandle: zone.resizeHandle,
            useCSSTransforms: zone.useCSSTransforms,
            transformScale: zone.transformScale,
            transformScaleRef: zone.transformScaleRef,
            noOverlay: zone.noOverlay,
            autoSize: false,
            ...container.grid,
            verticalCompact: undefined,
            margin: container.gap,
            containerPadding: [0, 0],
            maxRows: getContainerMaxRows(
                container,
                getGridProperties(getGridKey(container), defaults, groups, containers),
            ),
        };
    }
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
