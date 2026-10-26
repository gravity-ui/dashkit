import React from 'react';

import {prepareItem} from '../../hocs/prepareItem';
import {cn} from '../../utils/cn';

import type {ItemProps} from './types';

import './Item.scss';

const b = cn('dashkit-item');

// TODO: getDerivedStateFromError и заглушка с ошибкой
const Item: React.FC<ItemProps> = ({
    registerManager,
    rendererProps,
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
    const mountedRef = React.useRef(true);
    const loadGenerationRef = React.useRef(0);
    const completedLoadGenerationRef = React.useRef(0);
    const itemIdentityRef = React.useRef({});

    if (itemRef.current.id !== item.id || itemRef.current.type !== item.type) {
        itemIdentityRef.current = {};
    }
    itemRef.current = item;
    const {type} = item;
    onItemRenderRef.current = onItemRender;
    onItemMountChangeRef.current = onItemMountChange;

    const isRegisteredType = registerManager.check(type);

    React.useLayoutEffect(() => {
        mountedRef.current = true;
        if (isRegisteredType && !isPlaceholder) {
            onItemMountChangeRef.current?.(itemRef.current, {
                isAsync: isAsyncItemRef.current,
                isMounted: true,
            });

            if (!isAsyncItemRef.current) {
                onItemRenderRef.current?.(itemRef.current);
            }

            return () => {
                mountedRef.current = false;
                onItemMountChangeRef.current?.(itemRef.current, {
                    isAsync: isAsyncItemRef.current,
                    isMounted: false,
                });
            };
        }

        return undefined;
    }, []);

    const onLoad = React.useCallback(() => {
        onItemRenderRef.current?.(itemRef.current);
    }, []);

    const onBeforeLoad = React.useCallback(() => {
        isAsyncItemRef.current = true;
        const generation = ++loadGenerationRef.current;
        const identity = itemIdentityRef.current;
        return () => {
            if (
                mountedRef.current &&
                identity === itemIdentityRef.current &&
                (generation === loadGenerationRef.current ||
                    completedLoadGenerationRef.current === loadGenerationRef.current)
            ) {
                // Retained callbacks can report visual updates once the latest load has committed.
                completedLoadGenerationRef.current = loadGenerationRef.current;
                onLoad();
            }
        };
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

export default prepareItem(Item);
