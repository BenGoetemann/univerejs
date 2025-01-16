import _ from "lodash";

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
        // Use Lodash _.set to update nested keys safely
        this.state = _.set({ ...this.state }, path, value);
    }

    // -------------------------------------------------------------------
    // For nested keys (dot-delimited)
    // -------------------------------------------------------------------
    getNestedKeyValuePair(path: string): Record<string, unknown> {
        // Use Lodash _.get to retrieve nested values safely
        const value = _.get(this.state, path);

        // The "label" for the returned object is the **final** segment
        const lastKey = _.last(path.split(".")) || path;

        return { [lastKey]: value };
    }

    getKeyValuePair<K extends keyof T>(key: K): Record<K, T[K]> {
        return { [key]: this.state[key] } as Record<K, T[K]>;
    }
}
