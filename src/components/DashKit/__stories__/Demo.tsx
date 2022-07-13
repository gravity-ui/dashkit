import React from 'react';
import block from 'bem-cn-lite';
import './Demo.scss';

export type DemoProps = {
    title: string;
};

export type DemoRowProps = {
    title: string;
};

const b = block('dashkit-demo');

export default class Demo extends React.Component<DemoProps> {
    static Row: React.FC<DemoRowProps> = function ({title, children}) {
        return (
            <div className={b('row')}>
                <div className={b('row-title')}>{title}</div>
                <div className={b('row-content')}>{children}</div>
            </div>
        );
    };

    render() {
        const {title, children} = this.props;

        return (
            <div className={b()}>
                <h1 className={b('title')}>{title}</h1>
                <div className={b('content')}>{children}</div>
            </div>
        );
    }
}
