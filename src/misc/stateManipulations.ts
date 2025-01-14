import { Logger } from "./logger";
import { State } from "../utils/state";
import _ from "lodash"; // Lodash import

// --------------------------------------------------
// Shared logger instance
// --------------------------------------------------
const logger = new Logger();

function runStateManipulation<T extends Record<string, any>>(
    result: any,
    state: State<T>,
    from: string,
    to: string
): IActionResult {
    try {
        const parsedResult = JSON.parse(result.content); // Assumes result.content is a JSON string

        // Use Lodash _.get to safely access the nested property
        const value = _.get(parsedResult, from);

        if (value !== undefined) {
            // Use the State class's updateNestedKey method to set nested values instead of accessing `state.data`
            state.updateNestedKey(to, value);

            return {
                pass: true,
                reason: "State Manipulation Successful",
            };
        } else {
            return {
                pass: false,
                reason: `Key "${from}" not found in result.`,
            };
        }
    } catch (error) {
        return {
            pass: false,
            reason: `Error parsing result content: ${error}`,
        };
    }
}

export const set = <T extends Record<string, any>>(
    from: string,
    to: string = from
): IStateManipulationFunction => {
    return {
        run: (result: any, state: State<T>): IActionResult => {
            const stateManipulation = runStateManipulation(result, state, from, to);

            logger.stateManipulation(to, stateManipulation);
            return stateManipulation;
        },
    };
};
