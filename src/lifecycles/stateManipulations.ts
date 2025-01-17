// manipulation.ts
import { Logger } from "../helper/logger";
import { State } from "../base/state";
import _ from "lodash";

export type ManipulationCallback<T> = (state: State<any>, to: string, value: any) => void;

// --------------------------------------------------
// Shared logger instance
// --------------------------------------------------
const logger = new Logger();

/**
 * Generic helper function to perform state manipulation.
 * @param result - The result object containing the content.
 * @param state - The current state instance.
 * @param from - The path to retrieve the value from.
 * @param to - The path in the state where the value should be manipulated.
 * @param manipulate - A callback function that defines how to manipulate the state.
 * @returns IActionResult indicating the success or failure of the operation.
 */
function runStateManipulation<T extends Record<string, any>>(
    result: any,
    state: State<T>,
    from: string,
    to: string,
    manipulate: ManipulationCallback<T>
): IActionResult {
    try {
        const parsedResult = JSON.parse(result.content); // Assumes result.content is a JSON string

        // Use Lodash _.get to safely access the nested property
        const value = _.get(parsedResult, from);

        if (value === undefined) {
            return {
                pass: false,
                reason: `Key "${from}" not found in result.`,
            };
        }

        // Perform the specific manipulation using the callback
        manipulate(state, to, value);

        return {
            pass: true,
            reason: "State Manipulation Successful",
        };
    } catch (error) {
        return {
            pass: false,
            reason: `Error parsing result content: ${error}`,
        };
    }
}

// manipulation.ts (continued)

/**
 * Function to create a set state manipulation function.
 * @param from - The path to retrieve the value from.
 * @param to - The path in the state where the value should be set. Defaults to 'from' if not provided.
 * @returns IStateManipulationFunction that can be executed to perform the set operation.
 */
export const set = <T extends Record<string, any>>(
    from: string,
    to: string = from
): IStateManipulationFunction => {
    // Define the manipulation callback for setting a value
    const manipulate: ManipulationCallback<T> = (state, toPath, value) => {
        state.updateNestedKey(toPath, value);
    };

    return {
        run: (result: any, state: State<T>): IActionResult => {
            const stateManipulation = runStateManipulation(result, state, from, to, manipulate);

            logger.stateManipulation(to, stateManipulation);
            return stateManipulation;
        },
    };
};

/**
 * Function to create a push state manipulation function.
 * @param from - The path to retrieve the value from.
 * @param to - The path in the state where the value should be pushed. Defaults to 'from' if not provided.
 * @returns IStateManipulationFunction that can be executed to perform the push operation.
 */
export const push = <T extends Record<string, any>>(
    from: string,
    to: string = from
): IStateManipulationFunction => {
    // Define the manipulation callback for pushing to an array
    const manipulate: ManipulationCallback<T> = (state, toPath, value) => {
        const currentArray = _.get(state.getState(), toPath, []);

        if (!Array.isArray(currentArray)) {
            throw new Error(`Target path "${toPath}" is not an array.`);
        }

        // Push the new value into the array while maintaining immutability
        const updatedArray = [...currentArray, value];
        state.updateNestedKey(toPath, updatedArray);
    };

    return {
        run: (result: any, state: State<T>): IActionResult => {
            try {
                const stateManipulation = runStateManipulation(result, state, from, to, manipulate);

                logger.stateManipulation(to, stateManipulation);
                return stateManipulation;
            } catch (error) {
                // Handle specific errors from the manipulation callback
                return {
                    pass: false,
                    reason: `Error during push operation: ${error}`,
                };
            }
        },
    };
};
