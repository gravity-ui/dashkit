import React from 'react';

import PropTypes from 'prop-types';

import {prepareItem} from '../../hocs/prepareItem';
import {cn} from '../../utils/cn';

import './Item.scss';

const b = cn('dashkit-item');

// TODO: getDerivedStateFromError и заглушка с ошибкой

const Item = ({registerManager, rendererProps, type, isPlaceholder, forwardedPluginRef}) => {
    if (!registerManager.check(type)) {
        console.warn(`type [${type}] не зарегистрирован`);
        return null;
    }

    if (isPlaceholder) {
        return (
            <div className={b('placeholder')}>
                {registerManager
                    .getItem(type)
                    .placeholderRenderer?.(rendererProps, forwardedPluginRef) || null}
            </div>
        );
    }

    return (
        <div className={b('renderer')}>
            {registerManager.getItem(type).renderer(rendererProps, forwardedPluginRef)}
        </div>
    );
};

Item.propTypes = {
    forwardedPluginRef: PropTypes.any,
    rendererProps: PropTypes.object,
    registerManager: PropTypes.object,
    type: PropTypes.string,
    isPlaceholder: PropTypes.bool,
};

export default prepareItem(Item);
