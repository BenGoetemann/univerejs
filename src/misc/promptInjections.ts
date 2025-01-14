import { Logger } from "./logger";
import { State } from "../utils/state";
import { Agent } from "../utils/agent";

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
        if (field.includes(".")) {
            const value = state.getNestedKeyValuePair(field);
            if (value === undefined) {
                return {
                    pass: false,
                    reason: errorMsgFn(field),
                };
            }
            return {
                pass: true,
                reason: successMsgFn(value),
            };
        } else {
            const val = (state.getState() as any)[field];
            if (val === undefined) {
                return {
                    pass: false,
                    reason: errorMsgFn(field),
                };
            }
            // Use getKeyValuePair for consistency
            const value = state.getKeyValuePair(field as keyof T);
            return {
                pass: true,
                reason: successMsgFn(value),
            };
        }
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

export const chooseBetween = <T extends Record<string, any>>(agents: Agent[]): IEvaluationFunction => {
    return {
        run: (state: State<T>): IActionResult => {
            // logger.promptInjection(field, focusResult);

            const agentsToChooseFrom = JSON.stringify(agents.map(agent => ({
                name: agent.name,
                task: agent.task
            })))

            return {
                pass: true,
                reason: `You can choose one of the following agents, which helps you gather the information required in the state. The agents: ${agentsToChooseFrom}. The current state: ${state}.`
            }
        },
    };
};
