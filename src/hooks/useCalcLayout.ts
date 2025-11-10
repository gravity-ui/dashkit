import React from 'react';

import isEqual from 'lodash/isEqual';

import type {Config, ConfigItem, ConfigLayout} from '../shared';
import {RegisterManager} from '../utils';

function onUpdatePropsConfig(config: Config, registerManager: RegisterManager) {
    const configItems = [...config.items, ...(config.globalItems || [])];

    return config.layout.reduce<ConfigLayout[]>((acc, itemLayout, i) => {
        const item: ConfigItem | undefined = configItems[i];
        const foundItem =
            item && item.id === itemLayout.i
                ? item
                : configItems.find((configItem) => configItem.id === itemLayout.i);

        if (foundItem) {
            acc.push({
                ...registerManager.getItem(foundItem.type).defaultLayout,
                ...itemLayout,
            });
        }

        return acc;
    }, []);
}

export const useCalcPropsLayout = (config: Config, registerManager: RegisterManager) => {
    const [prevConfig, setPrevConfig] = React.useState(config);

    const [layout, updateLayout] = React.useState(onUpdatePropsConfig(config, registerManager));

    if (!isEqual(prevConfig.layout, config.layout)) {
        setPrevConfig(config);
        updateLayout(onUpdatePropsConfig(config, registerManager));
    }

    return layout;
};

// export const useManageLayout = (config: Config, registerManager: RegisterManager) => {
//     const propsLayout = useCalcPropsLayout(config, registerManager);

//     // так как мы не хотим хранить параметры виджета с активированной автовысотой в сторе и на сервере, актуальный
//     // (видимый юзером в конкретный момент времени) лэйаут (массив объектов с данными о ширине, высоте,
//     // расположении конкретного виджета на сетке) будет храниться в стейте, но, для того, чтобы в стор попадал
//     // лэйаут без учета вижетов с активированной автовысотой, в момент "подстройки" высоты виджета значение h
//     // (высота) из конфига будет запоминаться в originalLayouts, новое значение высоты в adjustedLayouts
//     const [currentLayout, setCurrentLayout] = React.useState(propsLayout);

// };
