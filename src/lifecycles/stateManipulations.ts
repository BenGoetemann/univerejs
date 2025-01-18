// manipulation.ts
import { Logger } from "../helper/logger";
import { State } from "../base/state";
import _ from "lodash";

export type IActionResult = {
    pass: boolean;
    reason: string;
};

export interface IStateManipulationFunction {
    run: (result: any, state: State<any>) => IActionResult;
}

// --------------------------------------------------
// Shared logger instance
// --------------------------------------------------
const logger = new Logger();

/**
 * Function to create a set state manipulation function.
 * @param from - The path to retrieve the value from.
 * @param to - The path in the state where the value should be set. Defaults to 'from' if not provided.
 * @returns IStateManipulationFunction that can be executed to perform the set operation.
 */
export const set = <T extends Record<string, any>>(
    from: string,
    to: string = from
): IStateManipulationFunction => ({
    run: (result: any, state: State<T>): IActionResult => {
        try {
            const parsedResult = JSON.parse(result.content);
            const value = _.get(parsedResult, from);

            if (value === undefined) {
                return {
                    pass: false,
                    reason: `Key "${from}" not found in result.`,
                };
            }

            state.updateNestedKey(to, value);

            logger.stateManipulation(to, { pass: true, reason: "Set operation successful." });
            return {
                pass: true,
                reason: "State manipulation successful.",
            };
        } catch (error) {
            logger.stateManipulation(to, { pass: false, reason: `Error: ${error}` });
            return {
                pass: false,
                reason: `Error processing set operation: ${error}`,
            };
        }
    },
});

/**
 * Function to create a push state manipulation function.
 * @param from - The path to retrieve the value from.
 * @param to - The path in the state where the value should be pushed. Defaults to 'from' if not provided.
 * @returns IStateManipulationFunction that can be executed to perform the push operation.
 */
export const push = <T extends Record<string, any>>(
    from: string,
    to: string = from
): IStateManipulationFunction => ({
    run: (result: any, state: State<T>): IActionResult => {
        try {
            const parsedResult = JSON.parse(result.content);
            const value = _.get(parsedResult, from);

            if (value === undefined) {
                return {
                    pass: false,
                    reason: `Key "${from}" not found in result.`,
                };
            }

            const currentArray = _.get(state.getState(), to, []);

            if (!Array.isArray(currentArray)) {
                return {
                    pass: false,
                    reason: `Target path "${to}" is not an array.`,
                };
            }

            const updatedArray = [...currentArray, value];
            state.updateNestedKey(to, updatedArray);

            logger.stateManipulation(to, { pass: true, reason: "Push operation successful." });
            return {
                pass: true,
                reason: "State manipulation successful.",
            };
        } catch (error) {
            logger.stateManipulation(to, { pass: false, reason: `Error: ${error}` });
            return {
                pass: false,
                reason: `Error processing push operation: ${error}`,
            };
        }
    },
});
