import type {ConfigItem, ConfigLayout} from '../types';

export interface AddConfigItem extends Omit<ConfigItem, 'id' | 'namespace'> {
    id?: null;
    namespace?: string;
    layout?: ConfigLayout;
}
export type SetConfigItem = ConfigItem | AddConfigItem;

export type SetItemOptions = {
    excludeIds?: string[];
};
