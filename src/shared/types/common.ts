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
