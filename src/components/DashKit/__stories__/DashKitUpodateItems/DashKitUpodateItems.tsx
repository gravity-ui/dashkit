import React, {useEffect} from 'react';
import {Demo, DemoRow} from '../Demo';
import {DashKit} from '../../DashKit';
import {Plugin} from '../../../../typings';
import {PluginTitleProps} from '../../../../../src/plugins';
import {TitleWithReq, TitleWithReqProps} from './TitleWithReq/TitleWithReq';
import {RadioGroup} from '@gravity-ui/uikit';
import {destroyStore, initStore} from './MockStore/MockStore';
import {StorageWidget} from './StorageWidget/StorageWidget';

const pluginTitle: Plugin<TitleWithReqProps> = {
    type: 'TitleWithReq',
    renderer(props, forwardedRef) {
        return <TitleWithReq {...props} ref={forwardedRef} />;
    },
};
const pluginStorageWidget: Plugin<PluginTitleProps> = {
    type: 'StorageWidget',
    renderer(props) {
        return <StorageWidget {...props} />;
    },
};

DashKit.registerPlugins(pluginTitle, pluginStorageWidget);

const config = {
    salt: '0.46703554571365613',
    counter: 5,
    aliases: {},
    connections: [],
    items: [
        {
            id: 'FastUpdateTitle',
            data: {
                size: 'm',
                text: 'Fast',
                reqDelay: 3,
            },
            type: 'TitleWithReq',
            namespace: 'default',
            orderId: 1,
        },
        {
            id: 'SlowUpdateTitle',
            data: {
                size: 'm',
                text: 'Slow',
                reqDelay: 6,
            },
            type: 'TitleWithReq',
            namespace: 'default',
            orderId: 1,
        },
        {
            id: 'Store',
            data: {
                size: 'm',
                text: 'Store',
            },
            type: 'StorageWidget',
            namespace: 'default',
            orderId: 1,
        },
    ],
    layout: [
        {
            h: 4,
            i: 'FastUpdateTitle',
            w: 26,
            x: 0,
            y: 0,
        },
        {
            h: 4,
            i: 'SlowUpdateTitle',
            w: 26,
            x: 0,
            y: 0,
        },
        {
            h: 8,
            i: 'Store',
            w: 10,
            x: 26,
            y: 0,
        },
    ],
};

export const DashKitUpdateItems = () => {
    const [autoUpdateMode, setAutoUpdateMode] = React.useState('update10s');
    const [autoupdateInterval, setAutoupdateInterval] = React.useState(10);
    const [realtimeMode, setRealtimeMode] = React.useState(false);

    useEffect(() => {
        initStore();
        return () => {
            destroyStore();
        };
    }, []);

    return (
        <Demo title="DashKit Update Items">
            <DemoRow title="Controls">
                <RadioGroup
                    value={autoUpdateMode}
                    onUpdate={(value) => {
                        setAutoUpdateMode(value);
                        switch (value) {
                            case 'update10s':
                                setAutoupdateInterval(10);
                                break;
                            case 'update1s':
                                setAutoupdateInterval(1);
                                break;
                            case 'realtime':
                                setRealtimeMode(true);
                                break;
                        }
                    }}
                    options={[
                        {value: 'update10s', content: 'Set autoupdate interval to 10s'},
                        {value: 'update1s', content: 'Set autoupdate interval to 1s'},
                        {value: 'realtime', content: 'Set Realtime Mode'},
                    ]}
                />
            </DemoRow>
            <DashKit
                config={config}
                editMode={false}
                settings={{autoupdateInterval, realtimeMode, silentLoading: false}}
            />
        </Demo>
    );
};
