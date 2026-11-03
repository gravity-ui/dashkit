import type {Config, ConfigLayout, GridStackContainer} from '../../shared';
import type {ReactGridLayoutProps} from '../../typings';

import {getGridKey, validateConfig, validateGrid} from './document';
import {requireValue} from './invariants';

export function getGridGeometry(width: number, props: ReactGridLayoutProps) {
    const [gapX, gapY] = props.margin || [10, 10];
    const [paddingX, paddingY] = props.containerPadding || props.margin || [10, 10];
    const cols = props.cols ?? 12;
    const rowHeight = props.rowHeight ?? 150;
    const stepX = (width - 2 * paddingX + gapX) / cols;
    const stepY = rowHeight + gapY;
    return {gapX, gapY, paddingX, paddingY, cols, rowHeight, stepX, stepY};
}

export function visibleGeometry(
    layout: Pick<ConfigLayout, 'x' | 'y' | 'w' | 'h'>,
    geometry: ReturnType<typeof getGridGeometry>,
) {
    return {
        left: layout.x * geometry.stepX,
        top: layout.y * geometry.stepY,
        width: Math.max(0, layout.w * geometry.stepX - geometry.gapX),
        height: Math.max(0, layout.h * geometry.stepY - geometry.gapY),
    };
}

export function getContainerMaxRows(container: GridStackContainer, parent: ReactGridLayoutProps) {
    const height =
        visibleGeometry(container, getGridGeometry(0, parent)).height -
        container.padding[0] -
        container.padding[2];
    // Keep the exact physical budget: flooring it would truncate valid saved fractions.
    return Math.min(
        container.grid.maxRows ?? Infinity,
        (height + container.gap[1]) / (container.grid.rowHeight + container.gap[1]),
    );
}

export type GridStackLayoutRect = {x: number; y: number; width: number; height: number};
// Measured widths can be transient; explicit snapshot projection remains strict.
export class GridStackWidthError extends Error {}
export type GridStackRootGrids = Record<
    string,
    {width: number; gridProperties: ReactGridLayoutProps}
>;

// Project saved local geometry for snapshots without mutating the document or mounting a grid.
export function getGridStackLayoutRects(config: Config, rootGrids: GridStackRootGrids) {
    validateConfig(config);
    const result: Record<string, GridStackLayoutRect> = Object.create(null);
    const grids = new Map<
        string,
        {
            x: number;
            y: number;
            width?: number;
            height?: number;
            geometry: ReturnType<typeof getGridGeometry>;
        }
    >();
    Object.entries(rootGrids).forEach(([id, {width, gridProperties}]) => {
        validateGrid(gridProperties);
        if (!Number.isFinite(width) || width <= 0) {
            throw new Error(`DashKitGridStack: invalid root width for "${id}"`);
        }
        const geometry = getGridGeometry(width, gridProperties);
        grids.set(`zone:${id}`, {x: geometry.paddingX, y: geometry.paddingY, geometry});
    });
    const checkExtent = (
        id: string,
        rect: ReturnType<typeof visibleGeometry>,
        parent: {width?: number; height?: number},
    ) => {
        if (
            parent.width !== undefined &&
            (rect.height <= 0 ||
                rect.left + rect.width > parent.width + 1e-7 ||
                rect.top + rect.height >
                    requireValue(parent.height, 'parent content height') + 1e-7)
        ) {
            throw new Error(`DashKitGridStack: child "${id}" exceeds its container content bounds`);
        }
        if (parent.width !== undefined && rect.width <= 0) {
            throw new GridStackWidthError(
                `DashKitGridStack: child "${id}" exceeds its container content bounds`,
            );
        }
    };
    const pending = [...(config.containers || [])];
    while (pending.length) {
        let resolved = false;
        for (let index = pending.length - 1; index >= 0; index--) {
            const container = pending[index];
            const parent = grids.get(getGridKey(container));
            if (!parent) {
                continue;
            }
            const rect = visibleGeometry(container, parent.geometry);
            checkExtent(container.id, rect, parent);
            const [top, right, bottom, left] = container.padding;
            const width = rect.width - left - right;
            const height = rect.height - top - bottom;
            if (height <= 0) {
                throw new Error(
                    `DashKitGridStack: padding exceeds container "${container.id}" usable width or height`,
                );
            }
            if (width <= 0) {
                throw new GridStackWidthError(
                    `DashKitGridStack: padding exceeds container "${container.id}" usable width or height`,
                );
            }
            const geometry = getGridGeometry(width, {
                ...container.grid,
                margin: container.gap,
                containerPadding: [0, 0],
            });
            if (geometry.stepX <= 0) {
                throw new GridStackWidthError(
                    `DashKitGridStack: padding exceeds container "${container.id}" width`,
                );
            }
            grids.set(`container:${container.id}`, {
                x: parent.x + rect.left + left,
                y: parent.y + rect.top + top,
                geometry,
                width,
                height: Math.min(
                    height,
                    (container.grid.maxRows ?? Infinity) * geometry.stepY - geometry.gapY,
                ),
            });
            pending.splice(index, 1);
            resolved = true;
        }
        if (!resolved) {
            throw new Error(
                'DashKitGridStack: cannot project cyclic, missing-container or missing-zone geometry',
            );
        }
    }
    config.layout.forEach((entry) => {
        const grid = grids.get(getGridKey(entry));
        if (!grid) {
            throw new Error(`DashKitGridStack: missing grid for widget "${entry.i}"`);
        }
        const rect = visibleGeometry(entry, grid.geometry);
        checkExtent(entry.i, rect, grid);
        result[entry.i] = {
            x: grid.x + rect.left,
            y: grid.y + rect.top,
            width: rect.width,
            height: rect.height,
        };
    });
    return result;
}
