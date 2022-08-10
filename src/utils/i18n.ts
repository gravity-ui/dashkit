import {I18N} from '@yandex-cloud/i18n';

import type {LANGS} from '../i18n';
export {LANGS} from '../i18n';

export const i18n = new I18N();

/**
 * Preferred method to set language.
 * @param lang
 * @return {void}
 */
export const setLang = (lang: LANGS) => {
    i18n.setLang(lang);
};
