import React from 'react';
import {MINIMAL_VIEWPORTS} from 'storybook/viewport';
import type {Decorator} from '@storybook/react';
import {withMobile} from './decorators/withMobile';
import {withLang} from './decorators/withLang';
import {Provider, configure, Lang} from '@gravity-ui/uikit';

import '@gravity-ui/uikit/styles/styles.scss';

configure({
    lang: Lang.En,
});

const withContextProvider: Decorator = (Story, context) => {
    return (
        <React.StrictMode>
            <Provider theme={context.globals.theme}>
                <Story {...context} />
            </Provider>
        </React.StrictMode>
    );
};

export const decorators = [withMobile, withLang, withContextProvider];

export const parameters = {
    viewport: {
        options: MINIMAL_VIEWPORTS,
    },
    options: {
        storySort: {
            order: ['Theme', 'Components', ['Basic']],
            method: 'alphabetical',
        },
    },
};

export const initialGlobals = {
    theme: 'light',
    lang: 'en',
    platform: 'desktop',
};

export const globalTypes = {
    theme: {
        name: 'Theme',
        toolbar: {
            icon: 'mirror',
            items: [
                {value: 'light', right: '☼', title: 'Light'},
                {value: 'dark', right: '☾', title: 'Dark'},
                {value: 'light-hc', right: '☼', title: 'High Contrast Light'},
                {value: 'dark-hc', right: '☾', title: 'High Contrast Dark'},
            ],
        },
    },
    lang: {
        name: 'Language',
        toolbar: {
            icon: 'globe',
            items: [
                {value: 'en', right: '🇬🇧', title: 'En'},
                {value: 'ru', right: '🇷🇺', title: 'Ru'},
            ],
        },
    },
    platform: {
        name: 'Platform',
        toolbar: {
            items: [
                {value: 'desktop', title: 'Desktop', icon: 'browser'},
                {value: 'mobile', title: 'Mobile', icon: 'mobile'},
            ],
        },
    },
};
