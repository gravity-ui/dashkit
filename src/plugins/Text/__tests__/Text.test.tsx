/** @jest-environment jsdom */

import React from 'react';

import {Provider} from '@gravity-ui/uikit';
import {fireEvent, render, screen} from '@testing-library/react';

import {PluginText} from '../Text';
import type {PluginTextProps} from '../Text';

const renderText = (apiHandler: PluginTextProps['apiHandler'], lang?: string) => {
    const props = {
        data: {text: 'text'},
        apiHandler,
        onBeforeLoad: () => () => {},
    } as unknown as PluginTextProps;

    return render(
        <Provider theme="light" lang={lang}>
            <PluginText {...props} />
        </Provider>,
    );
};

describe('Text plugin', () => {
    it('shows the error and retries the markdown request', async () => {
        const apiHandler = jest
            .fn<ReturnType<NonNullable<PluginTextProps['apiHandler']>>, [{text: string}]>()
            .mockRejectedValueOnce(new Error('failed'))
            .mockResolvedValueOnce({result: '<p>rendered</p>'});
        renderText(apiHandler);

        expect(await screen.findByText('Markdown transformation error')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', {name: 'Repeat'}));

        expect(await screen.findByText('rendered')).toBeTruthy();
        expect(apiHandler).toHaveBeenCalledTimes(2);
    });

    it('takes the error texts in the language of the uikit Provider', async () => {
        renderText(() => Promise.reject(new Error('failed')), 'ru');

        expect(await screen.findByText('Ошибка преобразования в markdown')).toBeTruthy();
        expect(screen.getByRole('button', {name: 'Повторить'})).toBeTruthy();
    });
});
