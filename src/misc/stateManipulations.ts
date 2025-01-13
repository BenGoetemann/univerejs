import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { Logger } from "./logger";
import { State } from "../utils/state";

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
    const parsedResult = JSON.parse(result.content); // Assumes result.content is a JSON string

    // Check if "from" exists at the top level in parsedResult
    if (parsedResult.hasOwnProperty(from)) {
        const value = parsedResult[from];
        
        // If there's a dot in `to`, assume it's a nested path
        if (to.includes(".")) {
            state.updateNestedKey(to, value);
        } else {
            // Fall back to the single-level update
            // (though here `to` is typed as string, 
            //  you can safely assume it's a top-level key if no dot)
            state.updateKey(to as keyof T, value);
        }

        return {
            pass: true,
            reason: "State Manipulation Successful",
        };
    } else {
        return {
            pass: false,
            reason: `Key "${String(from)}" not found in result.`,
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
