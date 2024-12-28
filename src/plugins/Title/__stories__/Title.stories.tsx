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
            <Card key="custom">
                <PluginTitle
                    data={{
                        fontSize: 40,
                        lineHeight: 100,
                        text: `Title with custom font params`,
                        showInTOC: true,
                    }}
                    {...args}
                />
            </Card>
        </Flex>
    ),
};
