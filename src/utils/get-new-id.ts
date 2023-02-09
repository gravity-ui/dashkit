import {extractIdsFromConfig, generateUniqId, Config} from '../shared';

type GetNewIdArgs = {
    config: Config;
    salt: Config['salt'];
    counter: Config['counter'];
    ids?: string[];
};

export function getNewId({config, salt, counter, ids = []}: GetNewIdArgs) {
    const allIds = [...extractIdsFromConfig(config), ...ids];
    return generateUniqId({salt, counter, ids: allIds});
}
