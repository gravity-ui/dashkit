import React from 'react';

import {Plugin, PluginWidgetProps} from '../../typings';
import {cn} from '../../utils/cn';
import {PLUGIN_ROOT_ATTR_NAME} from '../constants';

import './Title.scss';

export type PluginTitleSize = 'xl' | 'l' | 'm' | 's' | 'xs';

export interface PluginTitleProps extends PluginWidgetProps {
    data: {
        size: PluginTitleSize;
        text: string;
        showInTOC: boolean;
    } & PluginWidgetProps['data'];
}

const b = cn('dashkit-plugin-title');

export class PluginTitle extends React.Component<PluginTitleProps> {
    render() {
        const {data} = this.props;
        const text = data.text ? data.text : '';
        const size = data.size ? data.size : false;
        const id = data.showInTOC && text ? encodeURIComponent(text) : undefined;
        return (
            <div id={id} className={b({size})} {...{[PLUGIN_ROOT_ATTR_NAME]: 'title'}}>
                {text}
            </div>
        );
    }
}

const plugin: Plugin<PluginTitleProps> = {
    type: 'title',
    defaultLayout: {w: 36, h: 2},
    renderer(props, forwardedRef) {
        return <PluginTitle {...props} ref={forwardedRef} />;
    },
};

export default plugin;
