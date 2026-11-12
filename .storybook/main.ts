import type {StorybookConfig} from '@storybook/react-webpack5';

const config: StorybookConfig = {
    framework: {
        name: '@storybook/react-webpack5',
        options: {},
    },
    stories: ['../src/**/*.stories.@(ts|tsx)'],
    features: {
        backgrounds: false,
    },
    addons: ['@storybook/addon-webpack5-compiler-babel', '@storybook/preset-scss'],
};

export default config;
