import omit from 'lodash/omit';

import {META_KEY} from '../../constants';
import {GetItemsParamsArg, getItemsStateAndParams} from '../../modules';
import {ItemsStateAndParamsBase, PluginBase} from '../../types';

export const pluginControlBaseDL: PluginBase = {
    type: 'control',
};

export const pluginGroupControlBaseDL: PluginBase = {
    type: 'group_control',
};

export const pluginWidgetBaseDL: PluginBase = {
    type: 'widget',
};

const pluginsBaseDL: PluginBase[] = [
    {type: 'title'},
    {type: 'text'},
    pluginControlBaseDL,
    pluginWidgetBaseDL,
    pluginGroupControlBaseDL,
];

// Используется в DataLens на серверной стороне для формирования параметров и стейта чарта в рассылках
export function getItemsStateAndParamsDL(
    data: Omit<GetItemsParamsArg, 'plugins'>,
): ItemsStateAndParamsBase {
    const itemsStateAndParams = getItemsStateAndParams({
        ...data,
        plugins: pluginsBaseDL,
    });
    return omit(itemsStateAndParams, META_KEY);
}
