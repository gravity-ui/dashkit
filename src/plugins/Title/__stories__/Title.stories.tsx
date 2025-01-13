import React from 'react';

import {Card, Flex} from '@gravity-ui/uikit';
import {Meta, StoryObj} from '@storybook/react';

import {PluginTitle} from '../Title';
import {PluginTitleSize} from '../types';

export default {
    title: 'Components/Title',
    component: PluginTitle,
} as Meta;

type Story = StoryObj<typeof PluginTitle>;

const sizes: PluginTitleSize[] = ['xs', 's', 'm', 'l', 'xl'];

const defaultDataParams = {showInTOC: true};

export const PresetSizes: Story = {
    render: ({data: _, ...args}) => (
        <Flex direction="column" gap={6}>
            {sizes.map((size) => (
                <Card key={size}>
                    <PluginTitle
                        data={{size, text: `Title size=${size}`, showInTOC: true}}
                        {...args}
                    />
                </Card>
            ))}
        </Flex>
    ),
};

export const CustomSize: Story = {
    render: ({data: _, ...args}) => (
        <Flex direction="column" gap={6}>
            <Card>
                <PluginTitle
                    data={{
                        ...defaultDataParams,
                        size: {fontSize: '40px', lineHeight: '100px'},
                        text: `Title fontSize=40px, lineHeight=100px`,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        ...defaultDataParams,
                        size: {fontSize: '40px', lineHeight: '20px'},
                        text: `Title fontSize=40px, lineHeight=20px 🤷`,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        ...defaultDataParams,
                        size: {fontSize: '3em', lineHeight: '2'},
                        text: `Title fontSize=2em, lineHeight=2`,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        ...defaultDataParams,
                        size: {fontSize: '3em', lineHeight: '.7em'},
                        text: `Title fontSize=3em, lineHeight=.7em`,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        ...defaultDataParams,
                        size: {fontSize: '40px'},
                        text: `Title fontSize=40px`,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        ...defaultDataParams,
                        size: {fontSize: '300%'},
                        text: `Title fontSize=300%`,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        ...defaultDataParams,
                        size: {fontSize: '2.5rem'},
                        text: `Title fontSize=2.5rem`,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        ...defaultDataParams,
                        size: {fontSize: '3em'},
                        text: `Title fontSize=3em`,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        ...defaultDataParams,
                        size: {fontSize: '30pt'},
                        text: `Title fontSize=30pt`,
                    }}
                    {...args}
                />
            </Card>
        </Flex>
    ),
};

export const Default: Story = {
    render: ({data, ...args}) => (
        <Card>
            <PluginTitle data={data} {...args} />
        </Card>
    ),
    args: {
        data: {
            ...defaultDataParams,
            size: 'm',
            text: `Title`,
        },
    },
};
