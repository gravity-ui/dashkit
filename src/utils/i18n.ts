import {Lang, configure} from './configure';

/**
 * Preferred method to set language.
 * @param lang
 * @return {void}
 */
export const setLang = (lang: Lang) => {
    configure({lang: lang as Lang});
};
