import React from 'react';

import isEqual from 'lodash/isEqual';

import type {DashKitProps} from '../components/DashKit';
import type {ItemProps, RendererProps} from '../components/Item/types';
import {DashKitContext} from '../context';
import type {DashKitCtxShape} from '../context';
import type {ConfigItem, ConfigLayout} from '../shared';
import type {PluginRef, PluginWidgetProps, ReactGridLayoutProps} from '../typings';

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

    onItemRender?: DashKitProps['onItemRender'];
    onItemMountChange?: DashKitProps['onItemMountChange'];

    forwardedPluginRef?: (ref: PluginRef) => void;
};

export function prepareItem(
    WrappedComponent: React.ComponentType<ItemProps>,
): React.ComponentClass<PrepareItemProps> {
    return class PrepareItem extends React.Component<PrepareItemProps> {
        static contextType = DashKitContext;
        context!: React.ContextType<typeof DashKitContext>;

        _currentRenderProps: RendererProps = {} as RendererProps;

        shouldComponentUpdate(
            nextProps: PrepareItemProps,
            _nextState: never,
            nextContext: DashKitCtxShape,
        ) {
            const {width, height, transform} = this.props;
            const {width: widthNext, height: heightNext, transform: transformNext} = nextProps;

            // Layout changes (position/size) always trigger re-render
            if (width !== widthNext || height !== heightNext || transform !== transformNext) {
                return true;
            }

            // While dragging — skip content updates
            if (!nextProps.shouldItemUpdate) {
                return false;
            }

            const id = this.props.id;
            const ctx = this.context;

            // Re-render only if data relevant to this specific item changed
            return (
                this.props.item !== nextProps.item ||
                this.props.layout !== nextProps.layout ||
                ctx.itemsParams[id] !== nextContext.itemsParams[id] ||
                ctx.itemsState[id] !== nextContext.itemsState[id] ||
                ctx.editMode !== nextContext.editMode ||
                ctx.settings !== nextContext.settings ||
                ctx.context !== nextContext.context
            );
        }

        render() {
            const {item, isPlaceholder, forwardedPluginRef, onItemMountChange, onItemRender} =
                this.props;
            const {registerManager} = this.context;

            return (
                <WrappedComponent
                    forwardedPluginRef={forwardedPluginRef}
                    rendererProps={this.getRenderProps()}
                    registerManager={registerManager}
                    isPlaceholder={isPlaceholder}
                    onItemMountChange={onItemMountChange}
                    onItemRender={onItemRender}
                    item={item}
                />
            );
        }

        _onStateAndParamsChange: PluginWidgetProps['onStateAndParamsChange'] = (
            stateAndParams,
            options,
        ) => {
            this.context.onItemStateAndParamsChange(this.props.id, stateAndParams, options);
        };

        getRenderProps = (): RendererProps => {
            const {id, width, height, item, adjustWidgetLayout, layout, gridLayout} = this.props;
            const {itemsState, itemsParams, registerManager, settings, context, editMode} =
                this.context;
            const {data, defaults, namespace} = item;

            const rendererProps: RendererProps = {
                data,
                editMode,
                params: itemsParams[id],
                state: itemsState[id],
                onStateAndParamsChange: this._onStateAndParamsChange,
                width,
                height,
                id,
                defaults,
                namespace,
                settings,
                context,
                layout,
                gridLayout: gridLayout || registerManager.gridLayout,
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
    };
}
