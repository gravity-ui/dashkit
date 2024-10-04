import React from 'react';

import PropTypes from 'prop-types';

import {DashKitContext} from '../context/DashKitContext';

export function prepareItem(Component) {
    return class PrepareItem extends React.Component {
        static propTypes = {
            adjustWidgetLayout: PropTypes.func.isRequired,
            layout: PropTypes.array,
            id: PropTypes.string,
            item: PropTypes.object,
            shouldItemUpdate: PropTypes.bool,
            width: PropTypes.number,
            height: PropTypes.number,
            transform: PropTypes.string,
            isPlaceholder: PropTypes.bool,

            onItemRender: PropTypes.func,
            onItemMountChange: PropTypes.func,

            forwardedPluginRef: PropTypes.any,
        };

        shouldComponentUpdate(nextProps) {
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

        static contextType = DashKitContext;

        _onStateAndParamsChange = (stateAndParams, options) => {
            this.context.onItemStateAndParamsChange(this.props.id, stateAndParams, options);
        };

        _currentRenderProps = {};
        getRenderProps = () => {
            const {id, width, height, item, adjustWidgetLayout, layout, isPlaceholder} = this.props;
            const {itemsState, itemsParams, registerManager, settings, context, editMode} =
                this.context;
            const {data, defaults, namespace} = item;

            const rendererProps = {
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
                gridLayout: registerManager.gridLayout,
                adjustWidgetLayout,
                isPlaceholder,
            };

            const changedProp = Object.entries(rendererProps).find(
                ([key, value]) => this._currentRenderProps[key] !== value,
            );

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
                <Component
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
