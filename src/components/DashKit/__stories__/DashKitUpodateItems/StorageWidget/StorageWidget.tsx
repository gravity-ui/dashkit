import React from 'react';
import {PluginTitleProps} from '../../../../../plugins';

import {getStore, storeOnUpdateSubscribe} from '../MockStore/MockStore';
import {Card, Flex, Text} from '@gravity-ui/uikit';
import '../styles.scss';

export const StorageWidget = (props: PluginTitleProps) => {
    const [storeState, setStoreState] = React.useState<ReturnType<typeof getStore>>(getStore());

    React.useEffect(() => {
        storeOnUpdateSubscribe((store) => {
            setStoreState({...store});
        });
    }, [setStoreState]);

    return (
        <Card theme="info" view="filled" className="cardLayout">
            <div>
                <Text variant="display-1">{props.data.text}</Text>
                <div>{`counter: ${storeState.counter}`}</div>
            </div>
            <Flex justifyContent="flex-end">
                <span>{`update interval: ${storeState.updateInterval}s`}</span>
            </Flex>
        </Card>
    );
};
