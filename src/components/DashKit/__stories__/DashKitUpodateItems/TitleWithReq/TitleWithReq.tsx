import React from 'react';
import {PluginTitleProps} from '../../../../../../src/plugins';

import {getStore} from '../MockStore/MockStore';
import {Card, Flex, Text} from '@gravity-ui/uikit';
import '../styles.scss';

const getData = (timeout = 1000) => {
    return new Promise<string | number>((res) => {
        const counter = getStore().counter;
        setTimeout(() => {
            res(counter);
        }, timeout);
    });
};

export type TitleWithReqProps = {
    data: {reqDelay: number} & PluginTitleProps['data'];
} & PluginTitleProps;
type TitleWithReqState = {
    isLoading: boolean;
    counter?: string | number;
};

export class TitleWithReq extends React.Component<TitleWithReqProps, TitleWithReqState> {
    componentDidMount(): void {
        this.reload();
    }

    render() {
        return (
            <Card theme="normal" view="filled" className="cardLayout">
                <div>
                    <Text variant="display-1">{this.props.data.text}</Text>
                    <Flex justifyContent="space-between">
                        <span>{`counter: ${this.state?.counter}`}</span>
                        {this.state?.isLoading && <span>Loading...</span>}
                    </Flex>
                </div>
                <Flex justifyContent="flex-end">
                    <span>{`update interval: ${this.props.data.reqDelay}s`}</span>
                </Flex>
            </Card>
        );
    }

    async reload() {
        this.setState({isLoading: true});
        await getData(this.props.data.reqDelay * 1000).then((counter) => {
            this.setState({counter, isLoading: false});
        });
    }
}