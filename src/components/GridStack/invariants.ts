export function requireValue<T>(value: T | null | undefined, name: string): T {
    if (value === null || value === undefined) {
        throw new Error(`DashKitGridStack: missing ${name}`);
    }
    return value;
}
