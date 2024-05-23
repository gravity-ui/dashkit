import React from 'react';

import {DashKit} from '../../components/DashKit';
import {getConfig} from '../../components/DashKit/__stories__/utils';
import {Plugin, PluginWidgetProps} from '../../typings';

type PluginLayoutProps = {} & PluginWidgetProps;

export class PluginLayout extends React.Component<PluginLayoutProps> {
    render() {
        const {editMode} = this.props;

        return (
            <div style={{overflow: 'auto', maxHeight: '100%'}}>
                <DashKit editMode={editMode} config={getConfig()} />
            </div>
        );
    }
}

const plugin: Plugin<PluginLayoutProps> = {
    type: 'layout',
    defaultLayout: {w: 36, h: 1},
    renderer(props, forwardedRef) {
        return <PluginLayout {...props} ref={forwardedRef} />;
    },
};

export default plugin;
