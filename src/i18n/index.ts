import {i18n, setLang} from '../utils';

import en from './en.json';
import ru from './ru.json';

export type LANGS = 'ru' | 'en';

const COMPONENT = 'dashkit';

i18n.registerKeyset('en', COMPONENT, en);
i18n.registerKeyset('ru', COMPONENT, ru);

setLang('en');

export default i18n.keyset(COMPONENT);
