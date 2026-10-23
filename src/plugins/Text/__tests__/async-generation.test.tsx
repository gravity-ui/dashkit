/** @jest-environment jsdom */
jest.mock('@gravity-ui/uikit', () => {
    const ReactMock = require('react');
    return {
        Loader: () => ReactMock.createElement('span', null, 'loading'),
        Button: ({children}: {children?: unknown}) =>
            ReactMock.createElement('button', null, children),
    };
});

import React from 'react';

import {act, render} from '@testing-library/react';

import {PluginText} from '../Text';
import type {PluginTextProps} from '../Text';

function pending() {
    let resolve!: (result: {result: string}) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<{result: string}>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return {promise, resolve, reject};
}

// Critical: yes. Stale markdown must not overwrite the latest preview/export DOM or mark it ready.
test.each(['success', 'failure'] as const)(
    'ignores stale %s after a newer request completes',
    async (outcome) => {
        const old = pending();
        const next = pending();
        const oldComplete = jest.fn();
        const nextComplete = jest.fn();
        const onBeforeLoad = jest
            .fn()
            .mockReturnValueOnce(oldComplete)
            .mockReturnValueOnce(nextComplete);
        const props: PluginTextProps = {
            id: 'text',
            editMode: false,
            params: {},
            state: {},
            onStateAndParamsChange: jest.fn(),
            onBeforeLoad,
            onBeforeRender: jest.fn(),
            data: {text: 'old'},
            defaults: {},
            namespace: 'default',
            settings: {autoupdateInterval: 0, silentLoading: false},
            context: {},
            layout: [],
            gridLayout: {},
            adjustWidgetLayout: jest.fn(),
            apiHandler: ({text}) => (text === 'old' ? old.promise : next.promise),
        };
        const {rerender, getByText, queryByText} = render(<PluginText {...props} />);
        rerender(<PluginText {...props} data={{text: 'new'}} />);
        await act(async () => next.resolve({result: '<p>latest content</p>'}));
        expect(getByText('latest content')).toBeTruthy();
        expect(nextComplete).toHaveBeenCalledTimes(1);
        await act(async () => {
            if (outcome === 'success') {
                old.resolve({result: '<p>stale content</p>'});
            } else {
                old.reject(new Error('stale failure'));
            }
        });
        expect(getByText('latest content')).toBeTruthy();
        expect(queryByText('stale content')).toBeNull();
        expect(oldComplete).not.toHaveBeenCalled();
        expect(nextComplete).toHaveBeenCalledTimes(1);
    },
);

test('completion observes committed latest DOM and unmounted requests never complete', async () => {
    const response = pending();
    const complete = jest.fn(() => expect(document.body.textContent).toContain('committed'));
    const props: PluginTextProps = {
        id: 'text',
        editMode: false,
        params: {},
        state: {},
        onStateAndParamsChange: jest.fn(),
        onBeforeLoad: () => complete,
        onBeforeRender: jest.fn(),
        data: {text: 'load'},
        defaults: {},
        namespace: 'default',
        settings: {autoupdateInterval: 0, silentLoading: false},
        context: {},
        layout: [],
        gridLayout: {},
        adjustWidgetLayout: jest.fn(),
        apiHandler: () => response.promise,
    };
    const view = render(<PluginText {...props} />);
    await act(async () => response.resolve({result: '<p>committed</p>'}));
    expect(complete).toHaveBeenCalledTimes(1);
    const stale = pending();
    view.rerender(
        <PluginText {...props} data={{text: 'unmount'}} apiHandler={() => stale.promise} />,
    );
    view.unmount();
    await act(async () => stale.resolve({result: '<p>removed</p>'}));
    expect(complete).toHaveBeenCalledTimes(1);
});
