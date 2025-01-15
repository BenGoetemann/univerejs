export class State<T extends Record<string, any>> {
    private state: T;

    constructor(initialState: T) {
        this.state = initialState;
    }

    getState(): T {
        return { ...this.state };
    }

    /**
     * The original updateKey for single-level keys
     */
    updateKey<K extends keyof T>(key: K, value: T[K]): void {
        this.state = {
            ...this.state,
            [key]: value,
        };
    }

    /**
     * NEW: Update a nested field given a dot path, e.g. "weather.humidity"
     */
    updateNestedKey(path: string, value: unknown): void {
        // Break the dot-delimited path into separate parts
        const keys = path.split(".");

        // Make a shallow copy to avoid mutating the original object
        const nextState = { ...this.state };

        let current: any = nextState;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            // If the key doesn't exist or isn't an object, initialize it
            if (current[key] === undefined || typeof current[key] !== "object") {
                current[key] = {};
            }
            current = current[key];
        }

        // Set the final key to the provided value
        const lastKey = keys[keys.length - 1];
        current[lastKey] = value;

        // Reassign the updated copy back to state
        this.state = nextState;
    }

    // -------------------------------------------------------------------
    // For nested keys (dot-delimited)
    // -------------------------------------------------------------------
    getNestedKeyValuePair(path: string): Record<string, unknown> {
        const keys = path.split(".");

        // The "label" for the returned object is the **final** segment
        const lastKey = keys[keys.length - 1];

        // We do the standard "getNestedValue" logic
        let current: any = this.state;
        for (const key of keys) {
            // If any segment is missing or not an object, return undefined
            if (current === undefined || current === null || typeof current !== "object") {
                return { [lastKey]: undefined };
            }
            current = current[key];
        }

        // Return an object whose key is the last segment
        // and value is what was found at that path
        return { [lastKey]: current };
    }

    getKeyValuePair<K extends keyof T>(key: K): Record<K, T[K]> {
        return { [key]: this.state[key] } as Record<K, T[K]>;
    }
}