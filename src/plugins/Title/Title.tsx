import React from 'react';

import {Plugin, PluginWidgetProps} from '../../typings';
import {cn} from '../../utils/cn';
import {PLUGIN_ROOT_ATTR_NAME} from '../constants';

import type {TitleFontDataProps} from './types';

import './Title.scss';

export interface PluginTitleProps extends PluginWidgetProps {
    data: {
        text: string;
        showInTOC: boolean;
    } & TitleFontDataProps &
        PluginWidgetProps['data'];
}

const b = cn('dashkit-plugin-title');

export const PluginTitle = React.forwardRef<HTMLDivElement, PluginTitleProps>(
    function PluginTitle_(props, ref) {
        const {data} = props;
        const text = data.text ? data.text : '';
        const size = data.size ? data.size : false;
        const styles =
            data.fontSize && data.lineHeight
                ? {
                      fontSize: `${data.fontSize}px`,
                      lineHeight: `${data.lineHeight}px`,
                  }
                : {};
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
