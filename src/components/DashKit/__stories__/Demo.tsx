import React from 'react';
import block from 'bem-cn-lite';
import './Demo.scss';

export type DemoProps = React.PropsWithChildren<{
    title: string;
}>;

export type DemoRowProps = React.PropsWithChildren<{
    title: string;
}>;

const b = block('dashkit-demo');

export const Demo = ({title, children}: DemoProps) => {
    return (
        <div className={b()}>
            <h1 className={b('title')}>{title}</h1>
            <div className={b('content')}>{children}</div>
        </div>
    );
};

export const DemoRow = ({title, children}: DemoRowProps) => {
    return (
        <div className={b('row')}>
            <div className={b('row-title')}>{title}</div>
            <div className={b('row-content')}>{children}</div>
        </div>
    );
};
