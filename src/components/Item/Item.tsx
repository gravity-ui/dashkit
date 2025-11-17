import React from 'react';

import {prepareItem} from '../../hocs/prepareItem';
import type {ConfigItem} from '../../shared/types';
import type {PluginRef, PluginWidgetProps} from '../../typings';
import {cn} from '../../utils/cn';
import type {RegisterManager} from '../../utils/register-manager';

import './Item.scss';

const b = cn('dashkit-item');

type ItemProps = {
    registerManager: RegisterManager;
    rendererProps: Omit<PluginWidgetProps, 'onBeforeLoad'>;
    type: string;
    isPlaceholder?: boolean;
    forwardedPluginRef?: (pluginRef: PluginRef) => void;
    onItemRender?: (item: ConfigItem) => void;
    onItemMountChange?: (item: ConfigItem, meta: {isAsync: boolean; isMounted: boolean}) => void;
    item: ConfigItem;
};

// TODO: getDerivedStateFromError и заглушка с ошибкой
const Item: React.FC<ItemProps> = ({
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

        return undefined;
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

export default prepareItem(Item);
