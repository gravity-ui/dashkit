import React from 'react';
import {Story as StoryType, StoryContext} from '@storybook/react';

import {setLang} from '../../src/utils';

export function withLang(Story: StoryType, context: StoryContext) {
    const lang = context.globals.lang;

    setLang(lang);

    return <Story key={lang} {...context} />;
}
