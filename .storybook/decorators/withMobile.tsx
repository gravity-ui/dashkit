import React from 'react';
import type {Decorator} from '@storybook/react';
import {DashKit} from '../../src/components/DashKit/DashKit';

export const withMobile: Decorator = (Story, context) => {
    const platform = context.globals.platform;

    DashKit.setSettings({
        isMobile: platform === 'mobile',
    });

    return <Story key={platform} {...context} />;
};
