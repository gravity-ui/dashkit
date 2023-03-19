import React from 'react';
import isEmpty from 'lodash/isEmpty';
import {DashKitContext} from '../context/DashKitContext';
import PropTypes from 'prop-types';
import {transformParamsToActionParams} from '../shared';

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

        _onStateAndParamsChange = (stateAndParams) => {
            this.context.onItemStateAndParamsChange(this.props.id, stateAndParams);
        };

        render() {
            const {id, width, height, item, adjustWidgetLayout, layout} = this.props;
            const {
                itemsState,
                itemsParams,
                itemsActionParams,
                registerManager,
                settings,
                context,
                editMode,
            } = this.context;

            const actionParams = transformParamsToActionParams(itemsActionParams[id]);
            const resultParams = isEmpty(actionParams)
                ? itemsParams[id]
                : {...itemsParams[id], ...actionParams};

            const {type, data, defaults, namespace} = item;
            const rendererProps = {
                data,
                editMode,
                params: resultParams,
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
            };
            return (
                <Component
                    forwardedPluginRef={this.props.forwardedPluginRef}
                    rendererProps={rendererProps}
                    registerManager={registerManager}
                    type={type}
                />
            );
        }
    };
}
