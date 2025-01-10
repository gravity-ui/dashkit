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

export const Size: Story = {
    render: ({data: _, ...args}) => (
        <Flex direction="column" gap={2}>
            {sizes.map((size) => (
                <Card key={size}>
                    <PluginTitle
                        data={{size, text: `Title size=${size}`, showInTOC: true}}
                        {...args}
                    />
                </Card>
            ))}
            <Card>
                <PluginTitle
                    data={{
                        fontSize: 40,
                        lineHeight: 100,
                        text: `Title fontSize=40, lineHeight=100`,
                        showInTOC: true,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        size: 'l',
                        fontSize: 40,
                        text: `Title size=l, fontSize=40`,
                        showInTOC: true,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        size: 'l',
                        fontSize: 40,
                        lineHeight: 20,
                        text: `Title size=l, fontSize=40, lineHeight=20 🤷`,
                        showInTOC: true,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        size: 'l',
                        fontSize: 40,
                        lineHeight: 70,
                        text: `Title size=l, fontSize=40, lineHeight=70`,
                        showInTOC: true,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        size: 'l',
                        lineHeight: 70,
                        text: `Title size=l, lineHeight=70`,
                        showInTOC: true,
                    }}
                    {...args}
                />
            </Card>
            <Card>
                <PluginTitle
                    data={{
                        fontSize: 40,
                        text: `Title fontSize=40`,
                        showInTOC: true,
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
            size: 'm',
            text: `Title`,
            showInTOC: true,
        },
    },
};
