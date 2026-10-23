import React from 'react';

import pick from 'lodash/pick';

import {DEFAULT_GROUP, DEFAULT_NAMESPACE} from '../../constants';
import type {Config, ConfigLayout, ItemsStateAndParams} from '../../shared';
import type {
    AddConfigItem,
    AddNewItemOptions,
    DashKitGroup,
    GridReflowOptions,
    ReactGridLayoutProps,
    SetConfigItem,
} from '../../typings';
import {UpdateManager, reflowLayout} from '../../utils';
import {DashKitDnDWrapper} from '../DashKitDnDWrapper/DashKitDnDWrapper';
import DashKitView from '../DashKitView/DashKitView';
import type GridLayout from '../GridLayout/GridLayout';

import {DashKitBase, _emitSymbol} from './DashKitBase';
import {registerManager} from './registration';

export type {DashKitProps} from './DashKitBase';
export {_emitSymbol} from './DashKitBase';

const getReflowProps = (props: ReactGridLayoutProps): GridReflowOptions =>
    Object.assign(
        {compactType: 'vertical', cols: 36},
        pick(props, 'cols', 'maxRows', 'compactType'),
    );

const getReflowGroupsConfig = (groups: DashKitGroup[] = []) => {
    const defaultGridProps = getReflowProps(registerManager.gridLayout);

    return {
        defaultProps: defaultGridProps,
        groups: groups.reduce<Record<string, GridReflowOptions>>((memo, g) => {
            const groupId = g.id || DEFAULT_GROUP;
            memo[groupId] = g.gridProperties
                ? getReflowProps(g.gridProperties(defaultGridProps))
                : defaultGridProps;

            return memo;
        }, {}),
    };
};

function assertLegacyLayout(config: Pick<Config, 'layout' | 'containers' | 'layoutVersion'>) {
    if (
        config.layoutVersion === 2 ||
        config.containers?.length ||
        config.layout.some((item) => item.containerId)
    ) {
        throw new Error('Nested configuration requires @gravity-ui/dashkit/gridstack');
    }
}

export class DashKit extends DashKitBase<GridLayout> {
    static setItem({
        item: setItem,
        namespace = DEFAULT_NAMESPACE,
        config,
        options = {},
        groups = [],
    }: {
        item: SetConfigItem;
        namespace?: string;
        config: Config;
        options?: Omit<AddNewItemOptions, 'reflowLayoutOptions'>;
        groups?: DashKitGroup[];
    }): Config {
        assertLegacyLayout({
            ...config,
            layout: [...config.layout, ...(options.updateLayout || [])],
        });
        if (setItem.id) {
            return UpdateManager.editItem({
                item: setItem,
                namespace,
                config,
                options,
            });
        } else {
            const item = setItem as AddConfigItem;
            const registerManagerItem = registerManager.getItem(item.type);

            const layout = {...registerManagerItem.defaultLayout};

            const reflowLayoutOptions = getReflowGroupsConfig(groups);

            const copyItem = {...item};

            if (copyItem.layout) {
                assertLegacyLayout({layout: [{...copyItem.layout, i: 'incoming item'}]});
                Object.assign(layout, copyItem.layout);
                delete copyItem.layout;
            }

            return UpdateManager.addItem({
                item: copyItem,
                namespace,
                config,
                layout,
                options: {...options, reflowLayoutOptions},
            });
        }
    }

    static removeItem({
        id,
        config,
        itemsStateAndParams,
    }: {
        id: string;
        config: Config;
        itemsStateAndParams: ItemsStateAndParams;
    }): {config: Config; itemsStateAndParams: ItemsStateAndParams} {
        assertLegacyLayout(config);
        return UpdateManager.removeItem({id, config, itemsStateAndParams});
    }

    static reflowLayout({
        newLayoutItem,
        layout,
        groups,
    }: {
        newLayoutItem?: ConfigLayout;
        layout: ConfigLayout[];
        groups?: DashKitGroup[];
    }) {
        assertLegacyLayout({layout: newLayoutItem ? [...layout, newLayoutItem] : layout});
        return reflowLayout({
            newLayoutItem,
            layout,
            reflowLayoutOptions: getReflowGroupsConfig(groups),
        });
    }

    render() {
        assertLegacyLayout(this.props.config);
        const content = (
            <DashKitView
                registerManager={registerManager}
                ref={this.metaRef}
                {...this.props}
                emitDashKitEvent={this[_emitSymbol]}
            />
        );

        if (!this.context && this.props.groups) {
            return <DashKitDnDWrapper>{content}</DashKitDnDWrapper>;
        }

        return content;
    }
}
