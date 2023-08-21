import React from 'react';
import {cn} from '../../utils/cn';
import {PluginWidgetProps, Plugin} from '../../typings';
import './Title.scss';

export interface PluginTitleProps extends PluginWidgetProps {
    data: {
        size: 'l' | 'm' | 's' | 'xs';
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
            <div id={id} className={b({size})}>
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
