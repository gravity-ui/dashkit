export function shallowArrayEqual<T>(a: T[], b: T[]): boolean {
    if (a === b) {
        return true;
    }
    if (a.length !== b.length) {
        return false;
    }
    return a.every((item, i) => item === b[i]);
}

export function shallowObjectEqual<T extends object>(a: T, b: T): boolean {
    if (a === b) {
        return true;
    }
    const keysA = Object.keys(a) as Array<keyof T>;
    const keysB = Object.keys(b) as Array<keyof T>;
    if (keysA.length !== keysB.length) {
        return false;
    }
    return keysA.every((key) => a[key] === b[key]);
}
