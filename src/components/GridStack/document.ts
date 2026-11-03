import {DEFAULT_GROUP} from '../../constants/common';
import {extractIdsFromConfig, getAllConfigItems} from '../../shared';
import type {Config, ConfigLayout} from '../../shared';
import type {ReactGridLayoutProps} from '../../typings';

function fail(message: string): never {
    throw new Error(`DashKitGridStack: ${message}`);
}
const positive = (value: number) => Number.isFinite(value) && value > 0;

export function validateLayout(layout: ConfigLayout[]) {
    const ids = new Set<string>();
    layout.forEach((entry) => {
        if ('containerId' in entry) {
            fail('nested config is not supported by this flat renderer');
        }
        if (!entry.i || ids.has(entry.i)) {
            fail(`duplicate or missing widget layout id "${entry.i}"`);
        }
        ids.add(entry.i);
        if (
            ![entry.x, entry.y, entry.w, entry.h].every(Number.isFinite) ||
            entry.x < 0 ||
            entry.y < 0 ||
            !positive(entry.w) ||
            !positive(entry.h)
        ) {
            fail(`invalid finite geometry for "${entry.i}"`);
        }
    });
}
export function validateFlatDocument(config: object) {
    if ('containers' in config || 'layoutVersion' in config) {
        fail('nested config is not supported by this flat renderer');
    }
}
export function validateConfig(config: Config) {
    validateFlatDocument(config);
    if (!Array.isArray(config.items) || !Array.isArray(config.layout)) {
        fail('config items and layout must be arrays');
    }
    validateLayout(config.layout);
    const items = getAllConfigItems(config);
    const ids = items.flatMap((item) => [
        item.id,
        ...(item.data.tabs || []).map(({id}) => id),
        ...(item.data.group || []).map(({id}) => id),
    ]);
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
        fail('duplicate or missing widget/selector id');
    }
    config.layout.forEach((entry) => {
        if (!items.some(({id}) => id === entry.i)) {
            fail(`unknown widget layout "${entry.i}"`);
        }
    });
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

export const getGridKey = (entry: {parent?: string}) => `zone:${entry.parent || DEFAULT_GROUP}`;
export const configIds = extractIdsFromConfig;
