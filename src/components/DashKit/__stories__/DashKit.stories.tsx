import React from 'react';
import {Meta, Story} from '@storybook/react';
import {DashKit, DashKitProps} from '../DashKit';
import pluginTitle from '../../../plugins/Title/Title';
import pluginText from '../../../plugins/Text/Text';
import {DashKitShowcase} from './DashKitShowcase';
import {getConfig} from './utils';

export default {
    title: 'Components/DashKit',
    component: DashKit,
    args: {
        config: getConfig(),
    },
} as Meta;

DashKit.registerPlugins(
    pluginTitle,
    pluginText.setSettings({
        apiHandler: ({text}) => Promise.resolve({result: text + '...'}),
    }),
);
DashKit.registerPlugins({
    type: 'custom',
    defaultLayout: {
        w: 10,
        h: 8,
    },
    renderer: function CustomPlugin() {
        return <div>Custom widget with custom controls</div>;
    },
});

DashKit.setSettings({
    gridLayout: {margin: [8, 8]},
});

const DefaultTemplate: Story<DashKitProps> = (args) => <DashKit {...args} />;
export const Default = DefaultTemplate.bind({});

const ShowcaseTemplate: Story = () => <DashKitShowcase />;
export const Showcase = ShowcaseTemplate.bind({});
