import type {Config} from '../../shared';
import type {DashKitProps} from '../DashKit';

export type GridStackConfig = Config;

export type DashKitGridStackProps = Omit<DashKitProps, 'config' | 'onChange'> & {
    config: GridStackConfig;
    onChange?: (data: {
        config: GridStackConfig;
        itemsStateAndParams: NonNullable<DashKitProps['itemsStateAndParams']>;
        groups?: DashKitProps['groups'];
    }) => void;
};

export type {GridStackContainer} from '../../shared';
