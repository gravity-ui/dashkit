export type PluginTitleSize = 'xl' | 'l' | 'm' | 's' | 'xs';

export interface TitleFontParams {
    fontSize: number;
    lineHeight: number;
}

export type TitleFontDataProps =
    | {
          size: PluginTitleSize;
          fontSize?: number;
          lineHeight?: number;
      }
    | {
          size?: PluginTitleSize;
          fontSize: number;
          lineHeight?: number;
      };
