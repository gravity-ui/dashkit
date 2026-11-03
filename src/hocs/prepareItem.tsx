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
    const MemoizedItem = React.memo(WrappedComponent, (previous, next) => {
        if (!next.rendererProps.settings.isolateItemUpdates) {
            return false;
        }
        const sameItemProps = Object.entries(next).every(
            ([key, value]) => key === 'rendererProps' || previous[key as keyof ItemProps] === value,
        );
        if (!sameItemProps) {
            return false;
        }
        return Object.entries(next.rendererProps).every(([key, value]) => {
            const previousValue = previous.rendererProps[key as keyof RendererProps];
            if (key === 'layout') {
                return isEqual(
                    previous.rendererProps.layout.find(({i}) => i === previous.item.id),
                    next.rendererProps.layout.find(({i}) => i === next.item.id),
                );
            }
            if (key === 'gridLayout' || key === 'params' || key === 'state') {
                return isEqual(previousValue, value);
            }
            return previousValue === value;
        });
    });
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

            if (this.props.item.type !== nextProps.item.type) {
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
                !isEqual(this.props.gridLayout, nextProps.gridLayout) ||
                this.props.adjustWidgetLayout !== nextProps.adjustWidgetLayout ||
                this.props.forwardedPluginRef !== nextProps.forwardedPluginRef ||
                this.props.isPlaceholder !== nextProps.isPlaceholder ||
                ctx.itemsParams[id] !== nextContext.itemsParams[id] ||
                ctx.itemsState[id] !== nextContext.itemsState[id] ||
                ctx.editMode !== nextContext.editMode ||
                ctx.settings !== nextContext.settings ||
                ctx.context !== nextContext.context
            );
        }

        render() {
            const {item, isPlaceholder, forwardedPluginRef} = this.props;
            const {registerManager} = this.context;

            return (
                <MemoizedItem
                    key={item.type}
                    forwardedPluginRef={forwardedPluginRef}
                    rendererProps={this.getRenderProps()}
                    registerManager={registerManager}
                    plugin={registerManager.getItem(item.type)}
                    isPlaceholder={isPlaceholder}
                    onItemMountChange={this._onItemMountChange}
                    onItemRender={this._onItemRender}
                    item={item}
                />
            );
        }

        _onItemRender: ItemProps['onItemRender'] = (item) => this.props.onItemRender?.(item);

        _onItemMountChange: ItemProps['onItemMountChange'] = (item, state) =>
            this.props.onItemMountChange?.(item, state);

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
