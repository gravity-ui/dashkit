import {I18N} from '@gravity-ui/i18n';
import {getConfig, subscribeConfigure} from '../utils/configure';

import en from './en.json';
import ru from './ru.json';

export const i18n = new I18N();

const COMPONENT = 'dashkit';

i18n.registerKeyset('en', COMPONENT, en);
i18n.registerKeyset('ru', COMPONENT, ru);

i18n.setLang(getConfig().lang || 'en');

subscribeConfigure((config) => {
    if (config.lang) {
        i18n.setLang(config.lang);
    }
});

export default i18n.keyset(COMPONENT);
