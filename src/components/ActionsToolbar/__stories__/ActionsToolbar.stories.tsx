import React from 'react';
import {noop} from 'lodash';
import cn from 'bem-cn-lite';

import {Meta, Story} from '@storybook/react';
import {CogIcon} from '../../../icons/CogIcon';

import {ActionsToolbar, ActionsToolbarProps} from '../ActionsToolbar';

import '../ActionsToolbar.scss';
import './ActionsToolbarStory.scss';

const b = cn('actions-toolbar-story');

export default {
    title: 'Components/ActionsToolbar',
    component: ActionsToolbar,
    args: {
        controls: [
            {
                icon: CogIcon,
                text: 'Button 1',
                handler: noop(),
            },
            {
                icon: CogIcon,
                text: 'Button 2',
                handler: noop(),
            },
            {
                icon: CogIcon,
                text: 'Button 3',
                handler: noop(),
            },
            {
                icon: CogIcon,
                text: 'Button 4',
                handler: noop(),
            },
        ],
    },
} as Meta;

const DefaultTemplate: Story<ActionsToolbarProps> = (args) => <ActionsToolbar {...args} />;
export const Default = DefaultTemplate.bind({});

const FixedBottomTemplate: Story<ActionsToolbarProps> = (args) => (
    <div style={{display: 'flex', justifyContent: 'center'}}>
        <ActionsToolbar className={b('wrapper')} {...args} />
    </div>
);
export const FixedBottom = FixedBottomTemplate.bind({});
