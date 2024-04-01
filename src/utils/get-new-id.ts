import {extractIdsFromConfig, generateUniqId} from '../shared';
import type {Config} from '../types';

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
