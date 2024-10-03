import React from 'react';

import PropTypes from 'prop-types';

import {prepareItem} from '../../hocs/prepareItem';
import {cn} from '../../utils/cn';

import './Item.scss';

const b = cn('dashkit-item');

// TODO: getDerivedStateFromError и заглушка с ошибкой
const Item = ({
    registerManager,
    rendererProps,
    type,
    isPlaceholder,
    forwardedPluginRef,
    onItemRender,
    onItemMountChange,
    item,
}) => {
    const _isAsyncItem = React.useRef(false);

    const isRegisteredType = registerManager.check(type);

    React.useLayoutEffect(() => {
        if (isRegisteredType && !isPlaceholder) {
            onItemMountChange?.(item, {
                isAsync: _isAsyncItem.current,
                isMounted: true,
            });

            if (!_isAsyncItem.current) {
                onItemRender?.(item);
            }

            return () => {
                onItemMountChange?.(item, {
                    isAsync: _isAsyncItem.current,
                    isMounted: false,
                });
            };
        }
    }, [item]);

    const onLoad = React.useCallback(() => {
        onItemRender?.(item);
    }, [item, onItemRender]);

    const onBeforeLoad = React.useCallback(() => {
        _isAsyncItem.current = true;

        return onLoad;
    }, [onLoad]);

    const itemRendererProps = React.useMemo(() => {
        return {...rendererProps, onBeforeLoad};
    }, [rendererProps, onBeforeLoad]);

    if (!isRegisteredType) {
        console.warn(`type [${type}] не зарегистрирован`);
        return null;
    }

    if (isPlaceholder) {
        return (
            <div className={b('placeholder')}>
                {registerManager
                    .getItem(type)
                    .placeholderRenderer?.(itemRendererProps, forwardedPluginRef) || null}
            </div>
        );
    }

    return (
        <div className={b('renderer')}>
            {registerManager.getItem(type).renderer(itemRendererProps, forwardedPluginRef)}
        </div>
    );
};

Item.propTypes = {
    forwardedPluginRef: PropTypes.any,
    rendererProps: PropTypes.object,
    registerManager: PropTypes.object,
    type: PropTypes.string,
    isPlaceholder: PropTypes.bool,
    onItemRender: PropTypes.func,
    onItemMountChange: PropTypes.func,
    item: PropTypes.object,
};

export default prepareItem(Item);
