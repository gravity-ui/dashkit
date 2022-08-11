import {I18N} from '@yandex-cloud/i18n';

import type {Lang} from '../i18n';
export {Lang} from '../i18n';

export const i18n = new I18N();

/**
 * Preferred method to set language.
 * @param lang
 * @return {void}
 */
export const setLang = (lang: Lang) => {
    i18n.setLang(lang);
};
