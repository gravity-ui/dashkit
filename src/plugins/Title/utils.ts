import type {PluginTitleSize, TitleFontParams} from './types';

export function isCustomSize(size: PluginTitleSize | TitleFontParams): size is TitleFontParams {
    return typeof size === 'object';
}
