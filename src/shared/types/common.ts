import {ConfigLayout} from './config';

export type Dictionary<T = unknown> = Record<string, T>;

export interface StringParams extends Dictionary<string | string[]> {}

export interface GlobalParams extends StringParams {}

export type ItemDragProps = {
    type: string;
    layout?: {
        w?: number;
        h?: number;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extra?: any;
};

export type ItemDropDragOver = Omit<ConfigLayout, 'x' | 'y' | 'i'> & {
    type: string;
    i?: ConfigLayout['i'];
};

export type ItemDropProps = {
    commit: () => void;
    dragProps: ItemDragProps;
    itemLayout: ConfigLayout;
    newLayout: ConfigLayout[];
};
