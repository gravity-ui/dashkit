import React from 'react';

type AnimationStateType = {
    domPending: boolean;
    cssTransitionPending: boolean;
};

type AnimationStateActions =
    | {
          type: 'domPending';
          payload: boolean;
      }
    | {
          type: 'cssTransitionPending';
          payload: boolean;
      };

const animationStateReducer = (state: AnimationStateType, action: AnimationStateActions) => {
    switch (action.type) {
        case 'domPending': {
            return {
                ...state,
                domPending: action.payload,
            };
        }

        case 'cssTransitionPending': {
            return {
                ...state,
                // if transition started than element is ready
                domPending: false,
                cssTransitionPending: action.payload,
            };
        }

        default:
            return state;
    }
};

export const useAnimationState = ({
    element,
    enable,
    triggerProperty,
}: {
    element: HTMLElement | null;
    enable: boolean;
    triggerProperty: boolean;
}) => {
    const cssTransitionTimeout = React.useRef<ReturnType<typeof setTimeout>>();
    const [state, dispatch] = React.useReducer(animationStateReducer, {
        domPending: false,
        cssTransitionPending: false,
    });

    const transitionHandler = React.useCallback(
        (e?: TransitionEvent | null) => {
            const payload = e !== null && e?.type !== 'transitionend';
            dispatch({
                type: 'cssTransitionPending',
                payload,
            });

            if (payload) {
                clearTimeout(cssTransitionTimeout.current);
            }
        },
        [dispatch, cssTransitionTimeout],
    );

    const setDomPending = React.useCallback(
        (payload: boolean) => {
            dispatch({
                type: 'domPending',
                payload,
            });
        },
        [dispatch],
    );

    const propertyHandler = React.useCallback(() => {
        if (!enable) {
            return;
        }

        setDomPending(true);

        // timeout timer for transitionstart if no css transition rule
        cssTransitionTimeout.current = setTimeout(() => {
            setDomPending(false);
        }, 100);
    }, [enable, cssTransitionTimeout, setDomPending]);
    usePropWatcher(triggerProperty, propertyHandler);

    React.useEffect(() => {
        if (!enable) {
            element?.removeEventListener('transitionend', transitionHandler);
            element?.removeEventListener('transitionrun', transitionHandler);
            transitionHandler(null);
            return;
        }

        element?.addEventListener('transitionend', transitionHandler);
        element?.addEventListener('transitionrun', transitionHandler);
    }, [enable, element, transitionHandler]);

    return state.cssTransitionPending || state.domPending;
};

export function usePropWatcher<T>(value: T, onChange: (value: T) => void): T {
    const refState = React.useRef<T>(value);

    React.useLayoutEffect(() => {
        if (refState.current !== value) {
            refState.current = value;
            onChange?.(value);
        }
    }, [value, onChange]);

    return value;
}

export const useMount = () => {
    const [isMounted, setMountState] = React.useState(false);

    React.useEffect(() => {
        setMountState(true);
        return () => setMountState(false);
    }, [setMountState]);

    return isMounted;
};

export const useCssTransitionWatcher = ({
    isHidden,
    isEnabled,
    ref,
}: {
    isHidden: boolean;
    isEnabled: boolean;
    ref: React.MutableRefObject<HTMLElement | null>;
}) => {
    const [hiddenState, setHiddenState] = React.useState(isHidden);
    const [tansitionPending, startTransition] = React.useTransition();
    const animationPending = useAnimationState({
        element: ref.current,
        enable: isEnabled,
        triggerProperty: isHidden,
    });

    const onChange = React.useCallback(
        (value: boolean) => {
            if (isEnabled) {
                if (value) {
                    setHiddenState(value);
                } else {
                    startTransition(() => {
                        setHiddenState(value);
                    });
                }
            } else {
                setHiddenState(value);
            }
        },
        [isEnabled, setHiddenState],
    );
    usePropWatcher(isHidden, onChange);

    const isReadyToBeRemoved = !tansitionPending && !animationPending && hiddenState;
    const isPending = animationPending || tansitionPending;

    return {
        isPending,
        isReadyToBeRemoved,
        hiddenState,
    };
};
