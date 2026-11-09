import {DEFAULT_GROUP} from '../../constants/common';
import type {GridStackContainer} from '../../shared';
import type {DashKitGroup, ReactGridLayoutProps} from '../../typings';

import {getGridKey} from './document';
import type {EngineMode} from './engine';
import {getContainerMaxRows} from './geometry';
import {requireValue} from './invariants';

export type GridProperties = ReactGridLayoutProps &
    Required<Pick<ReactGridLayoutProps, 'cols' | 'rowHeight' | 'margin' | 'containerPadding'>>;

// Static edits and mounted grids must resolve the same geometry and inherited interactions.
export function getGridProperties(
    key: string,
    defaults: ReactGridLayoutProps,
    groups?: DashKitGroup[],
    containers?: GridStackContainer[],
): GridProperties {
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
            droppingItem: zone.droppingItem,
            autoSize: false,
            ...container.grid,
            width: undefined,
            style: undefined,
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

export function getEngineMode(properties: ReactGridLayoutProps): EngineMode {
    const compactType = properties.compactType === undefined ? 'vertical' : properties.compactType;
    return {
        compactType: properties.verticalCompact === false ? null : compactType,
        allowOverlap: properties.allowOverlap,
        preventCollision: properties.preventCollision,
    };
}
