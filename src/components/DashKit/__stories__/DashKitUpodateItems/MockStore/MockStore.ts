let store = {
    counter: 0,
    updateInterval: 1,
};

type StoreUpdateCallback = (state: typeof store) => void;
const onUpdateCallbacks: Array<StoreUpdateCallback> = [];

let interval: NodeJS.Timer | undefined;

export const storeOnUpdateSubscribe = (callback: StoreUpdateCallback) => {
    onUpdateCallbacks.push(callback);
};

export const initStore = () => {
    if (interval) return;

    store.counter = 0;

    interval = setInterval(() => {
        store = {...store, counter: store.counter + 1};
        onUpdateCallbacks.forEach((callback) => {
            callback(store);
        });
    }, store.updateInterval * 1000);
};

export const destroyStore = () => {
    clearInterval(interval);
    interval = undefined;
};

export const getStore = () => {
    return store;
};
