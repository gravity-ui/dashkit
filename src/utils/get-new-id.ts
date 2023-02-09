import {extractIdsFromConfig, generateUniqId, Config} from '../shared';

type GetNewIdArgs = {
    config: Config;
    salt: Config['salt'];
    counter: Config['counter'];
    excludeIds?: string[];
};

export function getNewId({config, salt, counter, excludeIds = []}: GetNewIdArgs) {
    const allIds = [...extractIdsFromConfig(config), ...excludeIds];
    return generateUniqId({salt, counter, ids: allIds});
}
