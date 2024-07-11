import React from 'react';

import isEqual from 'lodash/isEqual';

export const useDeepEqualMemo = <T extends any>(
    predicate: () => T,
    deps: React.DependencyList,
): T => {
    const previousValueRef = React.useRef<T>({} as any);
    const callbackRef = React.useRef(predicate);

    callbackRef.current = predicate;

    return React.useMemo(() => {
        const value = predicate();

        if (!isEqual(previousValueRef.current, value)) {
            previousValueRef.current = value;
        }

        return previousValueRef.current;
    }, [callbackRef, previousValueRef, ...deps]);
};
