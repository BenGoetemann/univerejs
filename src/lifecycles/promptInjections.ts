import { Logger } from "../helper/logger";
import { State } from "../base/state";
import _ from "lodash"; // Lodash import
import { IActionResult, IEvaluationFunction, TWorker } from "../types";

/**
 * Shared logger instance for logging prompt injections.
 */
const logger = new Logger();

/**
 * Logs prompt injections and evaluates the result of an injection.
 *
 * @template T - The type extending a record with string keys and any values.
 * @param {State<T>} state - The current state object.
 * @param {string | null} field - The field to focus on within the state.
 * @param {(value: any) => string} successMsgFn - Function to generate a success message.
 * @param {(field: string) => string} errorMsgFn - Function to generate an error message.
 * @returns {IActionResult} The result of the injection attempt.
 */
function runInjection<T extends Record<string, any>>(
    state: State<T>,
    field: string | null,
    successMsgFn: (value: any) => string,
    errorMsgFn: (field: string) => string
): IActionResult {
    if (field) {
        // TODO: Use the actual state method
        const value = _.get(state.getState(), field);

        if (value === undefined) {
            return {
                pass: false,
                reason: errorMsgFn(field),
            };
        }

        return {
            pass: true,
            reason: successMsgFn({ [_.last(field.split(".")) || field]: value }),
        };
    } else {
        return {
            pass: true,
            reason: `Infer your answer from the current state: ${JSON.stringify(state.getState())}`,
        };
    }
}

/**
 * Creates an evaluation function that focuses on a specific field within the state.
 *
 * @template T - The type extending a record with string keys and any values.
 * @param {string} field - The field to focus on.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const focusOn = <T extends Record<string, any>>(field: string): IEvaluationFunction => {
    return {
        run: (state: State<T>): IActionResult => {
            const focusResult = runInjection(
                state,
                field,
                (value) => `Please focus on this data: "${JSON.stringify(value)}".`,
                (missingField) => `Field "${missingField}" does not exist in the state.`
            );
            logger.promptInjection(field, focusResult);
            return focusResult;
        },
    };
};

/**
 * Creates an evaluation function that allows choosing between multiple agents.
 *
 * @template T - The type extending a record with string keys and any values.
 * @param {TWorker[]} agents - The list of agents to choose from.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const chooseBetween = <T extends Record<string, any>>(agents: TWorker[]): IEvaluationFunction => {
    return {
        run: (state: State<T>): IActionResult => {
            const agentsToChooseFrom = JSON.stringify(
                agents.map((agent) => ({
                    name: agent.name,
                    description: agent.description,
                }))
            );

            return {
                pass: true,
                reason: `You can choose one of the following agents, which helps you gather the information required in the state. The agents: ${agentsToChooseFrom}. The current state: ${JSON.stringify(state.getState())}.`,
            };
        },
    };
};
