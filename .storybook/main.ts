import type {StorybookConfig} from '@storybook/react-webpack5';

const config: StorybookConfig = {
    framework: {
        name: '@storybook/react-webpack5',
        options: {},
    },
    stories: ['../src/**/*.stories.@(ts|tsx)'],
    addons: [
        '@storybook/addon-webpack5-compiler-babel',
        '@storybook/preset-scss',
        {name: '@storybook/addon-essentials', options: {backgrounds: false}},
        './theme-addon/register.tsx',
    ],
};

export default config;
