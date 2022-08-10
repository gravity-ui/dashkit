import React from 'react';
import {Story as StoryType, StoryContext} from '@storybook/react';

import {i18n} from '../../src/utils';

export function withLang(Story: StoryType, context: StoryContext) {
    const lang = context.globals.lang;

    i18n.setLang(lang);

    return <Story key={lang} {...context} />;
}
