import React from 'react';

import {Flex} from '@gravity-ui/uikit';
import {Meta, StoryObj} from '@storybook/react';

import {PluginTitle, PluginTitleSize} from '../Title';

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
                <PluginTitle
                    key={size}
                    data={{size, text: `Title size=${size}`, showInTOC: true}}
                    {...args}
                />
            ))}
        </Flex>
    ),
};
