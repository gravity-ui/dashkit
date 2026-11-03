import {DEFAULT_GROUP, TEMPORARY_ITEM_ID} from '../../constants/common';
import {extractIdsFromConfig, getAllConfigItems} from '../../shared';
import type {Config, ConfigLayout, GridStackContainer} from '../../shared';
import type {DashKitGroup, ReactGridLayoutProps} from '../../typings';

function fail(message: string): never {
    throw new Error(`DashKitGridStack: ${message}`);
}
const positive = (value: number) => Number.isFinite(value) && value > 0;

export function validateConfig(config: Config, groups?: DashKitGroup[]) {
    if (
        !Array.isArray(config.items) ||
        !Array.isArray(config.layout) ||
        (config.containers !== undefined && !Array.isArray(config.containers))
    ) {
        fail('config items, layout and optional containers must be arrays');
    }
    const items = getAllConfigItems(config);
    validateLayout(
        config.layout,
        config.containers,
        groups,
        items.flatMap((item) => [
            item.id,
            ...(item.data.tabs || []).map(({id}) => id),
            ...(item.data.group || []).map(({id}) => id),
        ]),
    );
    const layoutIds = new Set<string>();
    config.layout.forEach((entry) => {
        if (layoutIds.has(entry.i) || !items.some((item) => item.id === entry.i)) {
            fail(`duplicate or unknown widget layout "${entry.i}"`);
        }
        layoutIds.add(entry.i);
    });
}

export function validateLayout(
    layout: ConfigLayout[],
    containerEntries: GridStackContainer[] = [],
    groups?: DashKitGroup[],
    itemIds = layout.map(({i}) => i),
) {
    const ids = new Set<string>();
    const zones = new Set(groups?.map((group) => group.id || DEFAULT_GROUP) || [DEFAULT_GROUP]);
    const addId = (id: string) => {
        if (!id || ids.has(id) || id === TEMPORARY_ITEM_ID) {
            fail(`duplicate or reserved id "${id}"`);
        }
        ids.add(id);
    };
    itemIds.forEach(addId);
    const containers = new Map(containerEntries.map((entry) => [entry.id, entry]));
    containerEntries.forEach((container) => {
        if (container.id === DEFAULT_GROUP || zones.has(container.id)) {
            fail(`duplicate or reserved id "${container.id}"`);
        }
        addId(container.id);
        if (
            !Array.isArray(container.padding) ||
            !Array.isArray(container.gap) ||
            container.padding.length !== 4 ||
            container.gap.length !== 2 ||
            [...container.padding, ...container.gap].some(
                (value) => !Number.isFinite(value) || value < 0,
            )
        ) {
            fail(`container "${container.id}" needs finite, nonnegative padding and gap`);
        }
        if (!container.grid) {
            fail(`invalid grid settings for container "${container.id}"`);
        }
        const {cols, rowHeight, compactType, maxRows} = container.grid;
        if (
            !Number.isInteger(cols) ||
            !positive(cols) ||
            !positive(rowHeight) ||
            (maxRows !== undefined && !positive(maxRows)) ||
            ![null, 'vertical', 'horizontal', 'horizontal-nowrap'].includes(compactType)
        ) {
            fail(`invalid grid settings for container "${container.id}"`);
        }
    });
    const geometry = (entry: Omit<ConfigLayout, 'i'>, id: string) => {
        if (
            ![entry.x, entry.y, entry.w, entry.h].every(Number.isFinite) ||
            entry.x < 0 ||
            entry.y < 0 ||
            !positive(entry.w) ||
            !positive(entry.h)
        ) {
            fail(`invalid finite geometry for "${id}"`);
        }
        if (
            entry.containerId !== undefined &&
            (typeof entry.containerId !== 'string' || !entry.containerId)
        ) {
            fail(`invalid containerId for "${id}"`);
        }
        const visited = new Set([id]);
        let parent = entry.containerId;
        while (parent) {
            if (visited.has(parent)) {
                fail(`cyclic container membership at "${id}"`);
            }
            visited.add(parent);
            const container = containers.get(parent);
            if (!container) {
                fail(`unknown container "${parent}" for "${id}"; move its children before removal`);
            }
            if ((entry.parent || DEFAULT_GROUP) !== (container.parent || DEFAULT_GROUP)) {
                fail(`inconsistent root zone for "${id}" and container "${parent}"`);
            }
            parent = container.containerId;
        }
    };
    layout.forEach((entry) => geometry(entry, entry.i));
    containerEntries.forEach((entry) => geometry(entry, entry.id));
}

export function validateGrid(props: ReactGridLayoutProps) {
    const cols = props.cols ?? 36;
    if (
        !Number.isInteger(cols) ||
        !positive(cols) ||
        !positive(props.rowHeight ?? 18) ||
        (props.maxRows !== undefined && props.maxRows !== Infinity && !positive(props.maxRows)) ||
        [...(props.margin || [2, 2]), ...(props.containerPadding || [0, 0])].some(
            (value) => !Number.isFinite(value) || value < 0,
        )
    ) {
        fail('invalid grid columns, rowHeight, maxRows or spacing');
    }
}

export const getGridKey = (entry: {parent?: string; containerId?: string}) =>
    entry.containerId ? `container:${entry.containerId}` : `zone:${entry.parent || DEFAULT_GROUP}`;

export function configIds(config: Config) {
    return [...extractIdsFromConfig(config), ...(config.containers || []).map(({id}) => id)];
}

// Project native positions as one document, retaining local coordinates when a subtree moves.
export function projectLayoutDocument(
    layout: ConfigLayout[],
    containers: GridStackContainer[] | undefined,
    readPosition: (id: string) => Omit<ConfigLayout, 'i'> | undefined,
) {
    const project = <T extends Omit<ConfigLayout, 'i'>>(entry: T, id: string): T => {
        const current = readPosition(id);
        if (!current) {
            return {...entry};
        }
        const next = {...entry, ...current};
        if (!next.parent) {
            delete next.parent;
        }
        if (!next.containerId) {
            delete next.containerId;
        }
        return next;
    };
    const nextContainers = containers?.map((entry) => project(entry, entry.id));
    const byId = new Map(nextContainers?.map((entry) => [entry.id, entry]));
    nextContainers?.forEach((entryInput) => {
        const entry = entryInput;
        const visited = new Set([entry.id]);
        let parent = entry.containerId;
        while (parent) {
            if (visited.has(parent)) {
                fail(`cyclic container membership at "${entry.id}"`);
            }
            visited.add(parent);
            const container = byId.get(parent);
            if (!container) {
                fail(`unknown container "${parent}" for "${entry.id}"`);
            }
            if (container.parent) {
                entry.parent = container.parent;
            } else {
                delete entry.parent;
            }
            parent = container.containerId;
        }
    });
    return {
        containers: nextContainers,
        layout: layout.map((entry) => {
            const next = project(entry, entry.i);
            if (next.containerId) {
                const container = byId.get(next.containerId);
                if (!container) {
                    fail(`unknown container "${next.containerId}" for "${entry.i}"`);
                }
                if (container.parent) {
                    next.parent = container.parent;
                } else {
                    delete next.parent;
                }
            }
            return next;
        }),
    };
}
