import React from 'react';

import isEqual from 'lodash/isEqual';

import {DashKitContext} from '../context';
import type {ConfigItem, ConfigLayout} from '../shared';
import type {
    ItemStateAndParams,
    ItemStateAndParamsChangeOptions,
} from '../shared/types/state-and-params';
import type {PluginRef, PluginWidgetProps, ReactGridLayoutProps} from '../typings';
import type {RegisterManager} from '../utils/register-manager';

type PrepareItemProps = {
    gridLayout?: ReactGridLayoutProps;
    adjustWidgetLayout: PluginWidgetProps['adjustWidgetLayout'];
    layout: ConfigLayout[];
    id: string;
    item: ConfigItem;
    shouldItemUpdate?: boolean;
    width?: number;
    height?: number;
    transform?: string;
    isPlaceholder?: boolean;

    onItemRender?: (item: ConfigItem) => void;
    onItemMountChange?: (item: ConfigItem, meta: {isAsync: boolean; isMounted: boolean}) => void;

    forwardedPluginRef?: (ref: PluginRef) => void;
};

type RendererProps = Omit<PluginWidgetProps, 'onBeforeLoad' | 'width' | 'height'> & {
    width?: number;
    height?: number;
};

type ItemComponentProps = {
    rendererProps: RendererProps;
    registerManager: RegisterManager;
    type: string;
    isPlaceholder?: boolean;
    onItemMountChange?: (item: ConfigItem, meta: {isAsync: boolean; isMounted: boolean}) => void;
    onItemRender?: (item: ConfigItem) => void;
    forwardedPluginRef?: (ref: PluginRef) => void;
    item: ConfigItem;
};

export function prepareItem(
    WrappedComponent: React.ComponentType<ItemComponentProps>,
): React.ComponentClass<PrepareItemProps> {
    return class PrepareItem extends React.Component<PrepareItemProps> {
        static contextType = DashKitContext;
        declare context: React.ContextType<typeof DashKitContext>;

        _currentRenderProps: RendererProps = {} as RendererProps;

        shouldComponentUpdate(nextProps: PrepareItemProps) {
            const {width, height, transform} = this.props;
            const {width: widthNext, height: heightNext, transform: transformNext} = nextProps;
            if (
                !nextProps.shouldItemUpdate &&
                width === widthNext &&
                height === heightNext &&
                transform === transformNext
            ) {
                return false;
            }
            return true;
        }

        _onStateAndParamsChange = (
            stateAndParams: ItemStateAndParams,
            options?: ItemStateAndParamsChangeOptions,
        ) => {
            this.context.onItemStateAndParamsChange(this.props.id, stateAndParams, options || {});
        };

        getRenderProps = (): RendererProps => {
            const {id, width, height, item, adjustWidgetLayout, layout, gridLayout} = this.props;
            const {itemsState, itemsParams, registerManager, settings, context, editMode} =
                this.context;
            const {data, defaults, namespace} = item;

            const defaultSettings: PluginWidgetProps['settings'] = {
                autoupdateInterval: 0,
                silentLoading: false,
            };
            const defaultContext: PluginWidgetProps['context'] = {};

            const rendererProps: RendererProps = {
                data,
                editMode,
                params: itemsParams[id] as RendererProps['params'],
                state: itemsState?.[id] || {},
                onStateAndParamsChange: this._onStateAndParamsChange,
                width,
                height,
                id,
                defaults,
                namespace,
                settings: settings || defaultSettings,
                context: context || defaultContext,
                layout: layout as RendererProps['layout'],
                gridLayout: (gridLayout ||
                    registerManager.gridLayout) as RendererProps['gridLayout'],
                adjustWidgetLayout,
            };

            const changedProp = Object.entries(rendererProps).find(([key, value]) => {
                // Checking gridLayoout deep as groups gridProperties method has tendancy to creat new objects
                if (key === 'gridLayout') {
                    return !isEqual(this._currentRenderProps[key as keyof RendererProps], value);
                }

                return this._currentRenderProps[key as keyof RendererProps] !== value;
            });

            if (changedProp) {
                this._currentRenderProps = rendererProps;
            }

            return this._currentRenderProps;
        };

        render() {
            const {item, isPlaceholder, forwardedPluginRef, onItemMountChange, onItemRender} =
                this.props;
            const {registerManager} = this.context;
            const {type} = item;

            return (
                <WrappedComponent
                    forwardedPluginRef={forwardedPluginRef}
                    rendererProps={this.getRenderProps()}
                    registerManager={registerManager}
                    type={type}
                    isPlaceholder={isPlaceholder}
                    onItemMountChange={onItemMountChange}
                    onItemRender={onItemRender}
                    item={item}
                />
            );
        }
    };
}
