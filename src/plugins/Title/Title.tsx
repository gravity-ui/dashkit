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

        const styles = getFontStyles(data);

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

function getFontStyles(props: TitleFontDataProps) {
    const {size, fontSize, lineHeight} = props;
    const styles: React.CSSProperties = {};

    if (lineHeight) {
        styles.lineHeight = `${lineHeight}px`;
    }
    if (fontSize) {
        styles.fontSize = `${fontSize}px`;

        const shouldSetRecommendedLineHeight = !lineHeight && !size;
        if (shouldSetRecommendedLineHeight) {
            const recommendedLineHeight = Math.round(fontSize * 1.25);
            styles.lineHeight = `${recommendedLineHeight}px`;
        }
    }

    return styles;
}

const plugin: Plugin<PluginTitleProps> = {
    type: 'title',
    defaultLayout: {w: 36, h: 2},
    renderer(props, forwardedRef) {
        return <PluginTitle {...props} ref={forwardedRef} />;
    },
};

export default plugin;
