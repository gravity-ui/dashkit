import omit from 'lodash/omit';
import {GetItemsParamsArg, getItemsStateAndParams} from '../../modules';
import {PluginBase, ItemsStateAndParamsBase} from '../../types';
import {META_KEY} from '../../constants';

export const pluginControlBaseDL: PluginBase = {
    type: 'control',
};

export const pluginWidgetBaseDL: PluginBase = {
    type: 'widget',
};

const pluginsBaseDL: PluginBase[] = [
    {type: 'title'},
    {type: 'text'},
    pluginControlBaseDL,
    pluginWidgetBaseDL,
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
