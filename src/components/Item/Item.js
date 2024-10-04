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
    // to avoid too frequent re-creation of functions that do not affect the rendering
    const isAsyncItemRef = React.useRef(false);
    const itemRef = React.useRef(item);
    const onItemRenderRef = React.useRef(onItemRender);
    const onItemMountChangeRef = React.useRef(onItemMountChange);

    itemRef.current = item;
    onItemRenderRef.current = onItemRender;
    onItemMountChangeRef.current = onItemMountChange;

    const isRegisteredType = registerManager.check(type);

    React.useLayoutEffect(() => {
        if (isRegisteredType && !isPlaceholder) {
            onItemMountChangeRef.current?.(itemRef.current, {
                isAsync: isAsyncItemRef.current,
                isMounted: true,
            });

            if (!isAsyncItemRef.current) {
                onItemRenderRef.current?.(itemRef.current);
            }

            return () => {
                onItemMountChangeRef.current?.(itemRef.current, {
                    isAsync: isAsyncItemRef.current,
                    isMounted: false,
                });
            };
        }
    }, []);

    const onLoad = React.useCallback(() => {
        onItemRenderRef.current?.(itemRef.current);
    }, []);

    const onBeforeLoad = React.useCallback(() => {
        isAsyncItemRef.current = true;

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
