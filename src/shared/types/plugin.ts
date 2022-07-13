import {ConfigItem} from './config';

interface PluginSpecialFields {
    prerenderMiddleware?: (item: ConfigItem) => ConfigItem;
}

export interface PluginBase extends PluginSpecialFields {
    type: string;
}
