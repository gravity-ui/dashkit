export type Dictionary<T = unknown> = Record<string, T>;

export interface StringParams extends Dictionary<string | string[]> {}

export interface GlobalParams extends StringParams {}
