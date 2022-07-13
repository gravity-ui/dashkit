import React from 'react';
import block from 'bem-cn-lite';
import PropTypes from 'prop-types';
import {prepareItem} from '../../hocs/prepareItem';
import './Item.scss';

const b = block('dashkit-item');

// TODO: getDerivedStateFromError и заглушка с ошибкой

const Item = ({registerManager, rendererProps, type, forwardedPluginRef}) => {
    if (!registerManager.check(type)) {
        console.warn(`type [${type}] не зарегистрирован`);
        return null;
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
};

export default prepareItem(Item);
