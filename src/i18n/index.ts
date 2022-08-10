import {i18n, setLang} from '../utils';

import en from './en.json';
import ru from './ru.json';

export enum LANGS {
    Ru = 'ru',
    En = 'en',
}

const COMPONENT = 'dashkit';

i18n.registerKeyset(LANGS.En, COMPONENT, en);
i18n.registerKeyset(LANGS.Ru, COMPONENT, ru);

setLang(LANGS.En);

export default i18n.keyset(COMPONENT);
