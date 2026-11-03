import React from 'react';

import {DEFAULT_NAMESPACE} from '../../constants/common';
import {withContext} from '../../hocs/withContext';
import type {Config} from '../../shared';
import type {AddConfigItem, AddNewItemOptions, DashKitGroup, SetConfigItem} from '../../typings';
import {UpdateManager} from '../../utils/update-manager';
import {DashKitBase, _emitSymbol} from '../DashKit/DashKitBase';
import {registerManager} from '../DashKit/registration';
import {DashKitDnDWrapper} from '../DashKitDnDWrapper/DashKitDnDWrapper';

import {GridStackLayout} from './GridStackLayout';
import {
    configIds,
    getGridKey,
    validateConfig,
    validateFlatDocument,
    validateGrid,
    validateLayout,
} from './document';
import {DashKitEngine} from './engine';
import {getGridProperties} from './grid-properties';
import {requireValue} from './invariants';
import {gridStackLayoutAdapter} from './layout-adapter';
import type {DashKitGridStackProps} from './types';

const GridStackView = withContext(GridStackLayout, gridStackLayoutAdapter);

export class DashKitGridStack extends DashKitBase {
    static reflowLayout(options: {
        newLayoutItem?: Config['layout'][number];
        layout: Config['layout'];
        groups?: DashKitGroup[];
    }) {
        validateFlatDocument(options);
        const {newLayoutItem, layout, groups} = options;
        const result = [...layout, ...(newLayoutItem ? [newLayoutItem] : [])].map((entry) => ({
            ...entry,
        }));
        validateLayout(result);
        const keys = new Set(result.map(getGridKey));
        keys.forEach((key) => {
            const props = getGridProperties(key, registerManager.gridLayout, groups);
            validateGrid(props);
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
            engine.batchUpdate();
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
        validateConfig(config);
        if (item.id) {
            const result = UpdateManager.editItem({item, namespace, config, options});
            return result;
        }
        const addition = item as AddConfigItem;
        const plugin = registerManager.getItem(item.type);
        const layout = {...plugin.defaultLayout, ...addition.layout};
        const props = getGridProperties(getGridKey(layout), registerManager.gridLayout, groups);
        const needsReflow =
            Boolean(options.updateLayout) ||
            Number.isFinite(layout.y) ||
            props.compactType === 'horizontal-nowrap';
        layout.w = Number.isFinite(layout.w) ? layout.w : props.cols || 36;
        layout.y = Number.isFinite(layout.y)
            ? layout.y
            : config.layout
                  .filter((entry) => getGridKey(entry) === getGridKey(layout))
                  .reduce((bottom, entry) => Math.max(bottom, entry.y + entry.h), 0);
        if (props.compactType === 'horizontal-nowrap') {
            const available =
                (props.cols || 36) -
                config.layout
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
                  }),
              }
            : next;
        validateConfig(result);
        return result;
    }

    static removeItem(options: {
        id: string;
        config: Config;
        itemsStateAndParams: NonNullable<DashKitGridStackProps['itemsStateAndParams']>;
    }) {
        validateConfig(options.config);
        if (
            ![...options.config.items, ...(options.config.globalItems || [])].some(
                (entry) => entry.id === options.id,
            )
        ) {
            throw new Error(`DashKitGridStack: unknown item "${options.id}"`);
        }
        return UpdateManager.removeItem(options);
    }

    declare props: DashKitGridStackProps & typeof DashKitBase.defaultProps;

    render() {
        validateConfig(this.props.config);
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

export type {DashKitGridStackProps, GridStackConfig} from './types';
