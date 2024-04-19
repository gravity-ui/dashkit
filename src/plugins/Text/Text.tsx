import React from 'react';

import {Button, Loader} from '@gravity-ui/uikit';

import {i18n} from '../../i18n';
import {Plugin, PluginWidgetProps} from '../../typings';
import {cn} from '../../utils/cn';
import {PLUGIN_ROOT_ATTR_NAME} from '../constants';

import './Text.scss';

// need to set markdown styles separately
// for instance can use yfm-transform

const b = cn('dashkit-plugin-text');

enum LoadStatus {
    Pending = 'pending',
    Success = 'success',
    Fail = 'fail',
}

export type PluginTextApiHandler = (data: {text: string}) => Promise<{result: string}>;

export interface PluginTextProps extends PluginWidgetProps {
    apiHandler?: PluginTextApiHandler;
    data: {
        text: string;
    } & PluginWidgetProps['data'];
}

interface PluginTextState {
    htmlText: string;
    status: LoadStatus;
    needUpdate?: boolean;
    text?: string;
}

export class PluginText extends React.PureComponent<PluginTextProps, PluginTextState> {
    static getDerivedStateFromProps(props: PluginTextProps, state: PluginTextState) {
        const {
            data: {text},
        } = props;
        const needUpdate = text !== state.text;
        return {
            text,
            needUpdate,
        };
    }

    state: PluginTextState = {
        htmlText: '',
        status: this.withMarkdown ? LoadStatus.Pending : LoadStatus.Success,
    };

    private _isUnmounted = false;

    componentDidMount() {
        this._isUnmounted = false;
        this.getMarkdown();
    }

    componentDidUpdate() {
        if (this.state.needUpdate) {
            this.getMarkdown();
        }
    }

    componentWillUnmount() {
        this._isUnmounted = true;
    }

    render() {
        switch (this.state.status) {
            case LoadStatus.Success:
                return this.renderText();
            case LoadStatus.Pending:
                return this.renderLoader();
            default:
                return this.renderError();
        }
    }

    private renderLoader() {
        return (
            <div className={b({loading: true})}>
                <div className={b('loader')}>
                    <div className={b('loader-view')}>
                        <Loader size="m" />
                    </div>
                </div>
            </div>
        );
    }

    private renderError() {
        return (
            <div className={b({error: true})}>
                <div className={b('error')}>{i18n('label_render-markdown-error')}</div>
                <br />
                <Button view="action" size="m" onClick={this.onRetryClick}>
                    {i18n('button_retry')}
                </Button>
                <br />
            </div>
        );
    }

    private renderText() {
        return (
            <div
                className={b({withMarkdown: this.withMarkdown})}
                {...{[PLUGIN_ROOT_ATTR_NAME]: 'text'}}
            >
                {this.withMarkdown ? (
                    <div
                        className="yfm" // className из стилей для markdown
                        dangerouslySetInnerHTML={{__html: this.state.htmlText}}
                    />
                ) : (
                    this.state.text
                )}
            </div>
        );
    }

    private async getMarkdown() {
        if (typeof this.props.apiHandler !== 'function') {
            return;
        }
        this.setState({status: LoadStatus.Pending});

        try {
            let htmlText = '';
            if (this.state.text && this.state.text.trim()) {
                const loadedData = await this.props.apiHandler({text: this.state.text});
                htmlText = loadedData.result;
            }
            if (this._isUnmounted) {
                return;
            }
            this.setState({
                htmlText,
                status: LoadStatus.Success,
            });
        } catch (e) {
            if (this._isUnmounted) {
                return;
            }
            this.setState({status: LoadStatus.Fail});
        }
    }

    private onRetryClick = () => {
        this.getMarkdown();
    };

    get withMarkdown() {
        return typeof this.props.apiHandler === 'function';
    }
}

type PluginDataProps = Omit<PluginTextProps, 'apiHandler'>;

export type PluginTextObjectSettings = {apiHandler?: PluginTextApiHandler};

export type PluginTextObject = Plugin<PluginDataProps> & {
    setSettings: (settings: PluginTextObjectSettings) => PluginTextObject;
    _apiHandler?: PluginTextApiHandler;
};

const plugin: PluginTextObject = {
    type: 'text',
    defaultLayout: {w: 12, h: 6},
    setSettings(settings) {
        const {apiHandler} = settings;
        plugin._apiHandler = apiHandler;
        return plugin;
    },
    renderer(props, forwardedRef) {
        return <PluginText {...props} apiHandler={plugin._apiHandler} ref={forwardedRef} />;
    },
    placeholderRenderer(_, forwardedRef) {
        return <div ref={forwardedRef}>Text placeholder</div>;
    },
};

export default plugin;
