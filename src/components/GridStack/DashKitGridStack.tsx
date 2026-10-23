import React from 'react';

import {DEFAULT_NAMESPACE} from '../../constants/common';
import {withContext} from '../../hocs/withContext';
import type {Config, GridStackContainer} from '../../shared';
import type {AddConfigItem, AddNewItemOptions, DashKitGroup, SetConfigItem} from '../../typings';
import {UpdateManager} from '../../utils/update-manager';
import {DashKitBase, _emitSymbol} from '../DashKit/DashKitBase';
import {registerManager} from '../DashKit/registration';
import {DashKitDnDWrapper} from '../DashKitDnDWrapper/DashKitDnDWrapper';

import {GridStackLayout} from './GridStackLayout';
import {configIds, getGridKey, validateConfig, validateLayout} from './document';
import {DashKitEngine} from './engine';
import {getGridProperties} from './grid-properties';
import {requireValue} from './invariants';
import {gridStackLayoutAdapter} from './layout-adapter';
import type {DashKitGridStackProps} from './types';

const GridStackView = withContext(GridStackLayout, gridStackLayoutAdapter);

export class DashKitGridStack extends DashKitBase {
    static reflowLayout({
        newLayoutItem,
        layout,
        groups,
        containers,
    }: {
        newLayoutItem?: Config['layout'][number];
        layout: Config['layout'];
        groups?: DashKitGroup[];
        containers?: GridStackContainer[];
    }) {
        const result = [...layout, ...(newLayoutItem ? [newLayoutItem] : [])].map((entry) => ({
            ...entry,
        }));
        if (containers?.length || result.some((entry) => entry.containerId !== undefined)) {
            validateLayout(result, containers, groups);
        }
        const keys = new Set(result.map(getGridKey));
        keys.forEach((key) => {
            const props = getGridProperties(key, registerManager.gridLayout, groups, containers);
            const engine = new DashKitEngine({
                column: props.cols || 36,
                maxRow: props.maxRows,
                float: true,
            });
            engine.mode = {
                compactType:
                    props.verticalCompact === false ? null : props.compactType ?? 'vertical',
                allowOverlap: props.allowOverlap,
            };
            if (props.compactType === null) {
                engine.mode.compactType = null;
            }
            const entries = result.filter((entry) => getGridKey(entry) === key);
            this.validateNestedLayout(entries, groups, containers);
            engine.batchUpdate();
            // Reflow returns widgets only, so descriptors are immovable collision footprints.
            containers
                ?.filter((entry) => getGridKey(entry) === key)
                .forEach(({id, x, y, w, h}) => engine.addNode({id, x, y, w, h, locked: true}));
            const prioritized = newLayoutItem
                ? [
                      ...entries.filter(({i}) => i === newLayoutItem.i),
                      ...entries.filter(({i}) => i !== newLayoutItem.i),
                  ]
                : entries;
            prioritized.forEach((entry) => engine.addNode({id: entry.i, ...entry}));
            engine.batchUpdate(false);
            entries.forEach((entry) => {
                const node = requireValue(
                    engine.nodes.find((candidate) => candidate.id === entry.i),
                    'reflowed widget node',
                );
                Object.assign(entry, {x: node.x, y: node.y, w: node.w, h: node.h});
            });
        });
        this.validateNestedLayout(result, groups, containers);
        return result;
    }

    static setItem({
        item,
        namespace = DEFAULT_NAMESPACE,
        config,
        options = {},
        groups,
    }: {
        item: SetConfigItem;
        namespace?: string;
        config: Config;
        options?: Omit<AddNewItemOptions, 'reflowLayoutOptions'>;
        groups?: DashKitGroup[];
    }): Config {
        validateConfig(config, groups);
        if (item.id) {
            const result = UpdateManager.editItem({item, namespace, config, options});
            this.validateNestedLayout(result.layout, groups, result.containers);
            return result;
        }
        const addition = item as AddConfigItem;
        const plugin = registerManager.getItem(item.type);
        const layout = {...plugin.defaultLayout, ...addition.layout};
        const props = getGridProperties(
            getGridKey(layout),
            registerManager.gridLayout,
            groups,
            config.containers,
        );
        const needsReflow =
            Boolean(options.updateLayout) ||
            Number.isFinite(layout.y) ||
            props.compactType === 'horizontal-nowrap';
        layout.w = Number.isFinite(layout.w) ? layout.w : props.cols || 36;
        layout.y = Number.isFinite(layout.y)
            ? layout.y
            : [...config.layout, ...(config.containers || [])]
                  .filter((entry) => getGridKey(entry) === getGridKey(layout))
                  .reduce((bottom, entry) => Math.max(bottom, entry.y + entry.h), 0);
        if (props.compactType === 'horizontal-nowrap') {
            const available =
                (props.cols || 36) -
                [...config.layout, ...(config.containers || [])]
                    .filter((entry) => getGridKey(entry) === getGridKey(layout))
                    .reduce((sum, entry) => sum + entry.w, 0);
            if (available < (layout.minW || 1)) {
                throw new Error('DashKitGridStack: no space in horizontal-nowrap grid');
            }
            layout.w = Math.min(layout.w, available);
            layout.y = 0;
        }
        const {layout: _layout, ...newItem} = addition;
        const next = UpdateManager.addItem({
            item: newItem,
            namespace,
            config,
            layout,
            options: {
                ...options,
                reflowLayoutOptions: undefined,
                excludeIds: [...(options.excludeIds || []), ...configIds(config)],
            },
        });
        const result = needsReflow
            ? {
                  ...next,
                  layout: this.reflowLayout({
                      layout: next.layout.filter((entry) =>
                          config.layout.some(({i}) => i === entry.i),
                      ),
                      newLayoutItem: next.layout.find(
                          (entry) => !config.layout.some(({i}) => i === entry.i),
                      ),
                      groups,
                      containers: config.containers,
                  }),
              }
            : next;
        validateConfig(result, groups);
        this.validateNestedLayout(result.layout, groups, result.containers);
        return result;
    }

    static removeItem(options: {
        id: string;
        config: Config;
        itemsStateAndParams: NonNullable<DashKitGridStackProps['itemsStateAndParams']>;
    }) {
        validateConfig(options.config);
        const container = options.config.containers?.find((entry) => entry.id === options.id);
        if (container) {
            if (
                options.config.layout.some((entry) => entry.containerId === options.id) ||
                options.config.containers?.some((entry) => entry.containerId === options.id)
            ) {
                throw new Error(
                    `DashKitGridStack: move or remove children before removing container "${options.id}"`,
                );
            }
            return {
                config: {
                    ...options.config,
                    containers: options.config.containers?.filter(
                        (entry) => entry.id !== options.id,
                    ),
                },
                itemsStateAndParams: options.itemsStateAndParams,
            };
        }
        if (
            ![...options.config.items, ...(options.config.globalItems || [])].some(
                (entry) => entry.id === options.id,
            )
        ) {
            throw new Error(`DashKitGridStack: unknown item "${options.id}"`);
        }
        return UpdateManager.removeItem(options);
    }

    private static validateNestedLayout(
        layout: Config['layout'],
        groups?: DashKitGroup[],
        containers?: GridStackContainer[],
    ) {
        [...layout, ...(containers || []).map(({id, ...entry}) => ({i: id, ...entry}))]
            .filter((entry) => entry.containerId)
            .forEach((entry) => {
                const props = getGridProperties(
                    getGridKey(entry),
                    registerManager.gridLayout,
                    groups,
                    containers,
                );
                if (
                    entry.y + entry.h > requireValue(props.maxRows, 'props.maxRows') + 1e-7 ||
                    entry.x + entry.w > requireValue(props.cols, 'props.cols')
                ) {
                    throw new Error(
                        `DashKitGridStack: child "${entry.i}" exceeds its container content bounds`,
                    );
                }
            });
    }

    declare props: DashKitGridStackProps & typeof DashKitBase.defaultProps;

    render() {
        validateConfig(this.props.config, this.props.groups);
        const content = (
            <GridStackView
                {...this.props}
                registerManager={registerManager}
                forwardedMetaRef={this.metaRef}
                emitDashKitEvent={this[_emitSymbol]}
            />
        );
        return !this.context && this.props.groups ? (
            <DashKitDnDWrapper>{content}</DashKitDnDWrapper>
        ) : (
            content
        );
    }
}

export type {DashKitGridStackProps, GridStackConfig, GridStackContainer} from './types';
