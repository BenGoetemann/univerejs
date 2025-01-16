import { Logger } from "../helper/logger";
import { State } from "../base/state";
import { Agent } from "../base/agent";
import _ from "lodash"; // Lodash import

// --------------------------------------------------
// Shared logger instance
// --------------------------------------------------
const logger = new Logger();

// --------------------------------------------------
// Helper to standardize the focus pattern
// --------------------------------------------------
function runInjection<T extends Record<string, any>>(
    state: State<T>,
    field: string | null,
    successMsgFn: (value: any) => string,
    errorMsgFn: (field: string) => string
): IActionResult {
    if (field) {
        // Use Lodash _.get to access nested properties
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

// --------------------------------------------------
// Individual focus functions
// --------------------------------------------------
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

export const chooseBetween = <T extends Record<string, any>>(agents: TWorker[]): IEvaluationFunction => {
    return {
        run: (state: State<T>): IActionResult => {
            const agentsToChooseFrom = JSON.stringify(agents.map(agent => ({
                name: agent.name,
                description: agent.description
            })));

            return {
                pass: true,
                reason: `You can choose one of the following agents, which helps you gather the information required in the state. The agents: ${agentsToChooseFrom}. The current state: ${JSON.stringify(state.getState())}.`
            };
        },
    };
};
