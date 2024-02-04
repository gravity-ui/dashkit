import React from 'react';
import {DashKitContext} from '../context/DashKitContext';
import PropTypes from 'prop-types';

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

            forwardedPluginRef: PropTypes.any,
            isPlaceholder: PropTypes.bool,
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

        render() {
            const {id, width, height, item, adjustWidgetLayout, layout, isPlaceholder} = this.props;
            const {itemsState, itemsParams, registerManager, settings, context, editMode} =
                this.context;
            const {type, data, defaults, namespace} = item;
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
            return (
                <Component
                    forwardedPluginRef={this.props.forwardedPluginRef}
                    rendererProps={rendererProps}
                    registerManager={registerManager}
                    type={type}
                    isPlaceholder={isPlaceholder}
                />
            );
        }
    };
}
