import type {StorybookConfig} from '@storybook/react-webpack5';

const config: StorybookConfig = {
    framework: {
        name: '@storybook/react-webpack5',
        options: {fastRefresh: true, legacyRootApi: false},
    },
    babel: async (options) => ({
        ...options,
        plugins: [
            ['@babel/plugin-transform-typescript', {allowDeclareFields: true}],
            ...(options.plugins || []),
        ],
    }),
    stories: [
        '../src/**/*.stories.@(ts|tsx)',
        ...(process.env.DASHKIT_TEST_STORIES === '1'
            ? ['../tests/browser/stories/**/*.stories.@(ts|tsx)']
            : []),
    ],
    docs: {
        autodocs: false,
    },
    addons: [
        '@storybook/preset-scss',
        {name: '@storybook/addon-essentials', options: {backgrounds: false}},
        './theme-addon/register.tsx',
    ],
};

export default config;
