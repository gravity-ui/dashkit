import React from 'react';

import {Plugin, PluginWidgetProps} from '../../typings';
import {cn} from '../../utils/cn';
import {PLUGIN_ROOT_ATTR_NAME} from '../constants';

import type {PluginTitleSize, TitleFontParams} from './types';
import {isCustomSize} from './utils';

import './Title.scss';

export interface PluginTitleProps extends PluginWidgetProps {
    data: {
        size: PluginTitleSize | TitleFontParams;
        text: string;
        showInTOC: boolean;
    } & PluginWidgetProps['data'];
}

const b = cn('dashkit-plugin-title');

const RECCOMMENDED_LINE_HEIGHT_MULTIPLIER = 1.25;

export const PluginTitle = React.forwardRef<HTMLDivElement, PluginTitleProps>(
    function PluginTitle_(props, ref) {
        const {data} = props;
        const text = data.text ? data.text : '';

        const size = isCustomSize(data.size) ? false : data.size;
        const styles = isCustomSize(data.size)
            ? {
                  fontSize: data.size.fontSize,
                  lineHeight: data.size.lineHeight ?? RECCOMMENDED_LINE_HEIGHT_MULTIPLIER,
              }
            : undefined;

        const id = data.showInTOC && text ? encodeURIComponent(text) : undefined;

        return (
            <div
                ref={ref}
                id={id}
                style={styles}
                className={b({size})}
                {...{[PLUGIN_ROOT_ATTR_NAME]: 'title'}}
            >
                {text}
            </div>
        );
    },
);

const plugin: Plugin<PluginTitleProps> = {
    type: 'title',
    defaultLayout: {w: 36, h: 2},
    renderer(props, forwardedRef) {
        return <PluginTitle {...props} ref={forwardedRef} />;
    },
};

export default plugin;
