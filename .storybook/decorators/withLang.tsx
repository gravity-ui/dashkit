import React from 'react';
import {Story as StoryType, StoryContext} from '@storybook/react';
import {configure as uiKitConfigure, Lang as UILang} from '@gravity-ui/uikit';

import {setLang} from '../../src/utils';

export function withLang(Story: StoryType, context: StoryContext) {
    const lang = context.globals.lang;

    uiKitConfigure({lang: lang as UILang});
    setLang(lang);

    return <Story key={lang} {...context} />;
}
