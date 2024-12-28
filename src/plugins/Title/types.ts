export type PluginTitleSize = 'xl' | 'l' | 'm' | 's' | 'xs';

export interface TitleFontParams {
    fontSize: number;
    lineHeight: number;
}

interface FontSizeProps {
    size: PluginTitleSize;
}

type UndefinedProps<T extends Object> = Partial<Record<keyof T, undefined>>;

export type TitleFontDataProps =
    | (FontSizeProps & UndefinedProps<TitleFontParams>)
    | (UndefinedProps<FontSizeProps> & TitleFontParams);
