import type {ConfigItem, ItemParams} from '../../shared/types';
import type {PluginRef, PluginWidgetProps} from '../../typings';
import type {RegisterManager} from '../../utils/register-manager';
import type {DashKitProps} from '../DashKit';

export type RendererProps = Omit<
    PluginWidgetProps<ItemParams>,
    'onBeforeLoad' | 'width' | 'height'
> & {
    width?: number;
    height?: number;
};

export type ItemProps = {
    forwardedPluginRef?: (ref: PluginRef) => void;
    isPlaceholder?: boolean;
    item: ConfigItem;
    registerManager: RegisterManager;
    rendererProps: RendererProps;
    type: string;
    onItemRender?: DashKitProps['onItemRender'];
    onItemMountChange?: DashKitProps['onItemMountChange'];
};
