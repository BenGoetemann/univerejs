import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { Logger } from "./logger";

// TODO: Implement nested evaluation like weather.humidity

// --------------------------------------------------
// Shared logger instance
// --------------------------------------------------
const logger = new Logger();

// --------------------------------------------------
// Helper to standardize the evaluation pattern
// --------------------------------------------------
function runEvaluation(
    state: any,
    field: string,
    conditionFn: (value: any) => boolean,
    errorMsgFn: (value: any) => string
): IActionResult {
    // 1) Check field existence
    if (!state.hasOwnProperty(field)) {
        return {
            pass: false,
            reason: `Evaluation unsuccessful: The last result does not contain the field: ${field}`,
        };
    }

    // 2) Evaluate condition
    const value = state[field];
    const pass = conditionFn(value);

    // 3) Build result
    return {
        pass,
        reason: pass
            ? "Evaluation successful"
            : `Evaluation unsuccessful: ${errorMsgFn(value)}`,
    };
}

// --------------------------------------------------
// Individual checks
// --------------------------------------------------

export const isSet = (field: string): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) =>
                    Array.isArray(value)
                        ? value.length > 0
                        : value !== undefined && value !== null,
                () => `Field "${field}" is not set!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Greater than
export const gt = (field: string, x: number): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) =>
                    (Array.isArray(value) && value.length > x) ||
                    (typeof value === "number" && value > x),
                (value) => `Field "${field}" with value ${value} is not greater than ${x}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Less than
export const lt = (field: string, x: number): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) =>
                    (Array.isArray(value) && value.length < x) ||
                    (typeof value === "number" && value < x),
                (value) => `Field "${field}" with value ${value} is not less than ${x}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Equal to
export const eq = (field: string, x: any): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) => value === x,
                (value) => `Field "${field}" with value ${value} is not equal to ${x}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Not equal to
export const neq = (field: string, x: any): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) => value !== x,
                (value) => `Field "${field}" with value ${value} is equal to ${x}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Contains
export const contains = (field: string, element: any): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) => {
                    if (Array.isArray(value)) {
                        // For arrays, check if any item includes the element (if item is string-like)
                        return value.some((item) => {
                            if (typeof item === "string" && typeof element === "string") {
                                return item.toLowerCase().includes(element.toLowerCase());
                            }
                            // If you want to check for strict equality, you can do so here
                            return false;
                        });
                    }
                    if (typeof value === "string" && typeof element === "string") {
                        return value.toLowerCase().includes(element.toLowerCase());
                    }
                    return false;
                },
                () => `Field "${field}" does not contain ${element}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Not empty
export const notEmpty = (field: string): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) =>
                    (Array.isArray(value) || typeof value === "string") &&
                    value.length > 0,
                () => `Field "${field}" is empty!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Greater than or equal to
export const gte = (field: string, x: number): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) =>
                    (Array.isArray(value) && value.length >= x) ||
                    (typeof value === "number" && value >= x),
                (value) =>
                    `Field "${field}" with value ${value} is not greater than or equal to ${x}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Less than or equal to
export const lte = (field: string, x: number): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) =>
                    (Array.isArray(value) && value.length <= x) ||
                    (typeof value === "number" && value <= x),
                (value) =>
                    `Field "${field}" with value ${value} is not less than or equal to ${x}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Between
export const between = (field: string, min: number, max: number): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) =>
                    (typeof value === "number" && value >= min && value <= max) ||
                    (Array.isArray(value) && value.length >= min && value.length <= max),
                (value) =>
                    `Field "${field}" with value ${value} is not between ${min} and ${max}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Starts with
export const startsWith = (field: string, prefix: string): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) => typeof value === "string" && value.startsWith(prefix),
                (value) =>
                    `Field "${field}" with value ${value} does not start with ${prefix}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Ends with
export const endsWith = (field: string, suffix: string): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) => typeof value === "string" && value.endsWith(suffix),
                (value) =>
                    `Field "${field}" with value ${value} does not end with ${suffix}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Matches regex
export const matches = (field: string, regex: RegExp): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) => typeof value === "string" && regex.test(value),
                (value) =>
                    `Field "${field}" with value ${value} does not match regex ${regex}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Not contains
export const notContains = (field: string, element: any): IEvaluationFunction => {
    return {
        run: (state: any) => {
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) => {
                    if (Array.isArray(value)) {
                        return !value.includes(element);
                    }
                    if (typeof value === "string" && typeof element === "string") {
                        return !value.includes(element);
                    }
                    return true; // If it's neither array nor string, default to true
                },
                (value) =>
                    `Field "${field}" with value ${value} contains ${element}!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// Is empty
export const isEmpty = (field: string): IEvaluationFunction => {
    return {
        run: (state: any) => {
            // Special logic: if field doesn't exist at all, we consider it pass: true
            if (!state.hasOwnProperty(field)) {
                const evaluationResult = {
                    pass: true,
                    reason: "Evaluation successful",
                };
                logger.evaluation(field, evaluationResult);
                return evaluationResult;
            }

            // If the field exists, run normal check
            const evaluationResult = runEvaluation(
                state,
                field,
                (value) =>
                    (Array.isArray(value) || typeof value === "string") &&
                    value.length === 0,
                (value) =>
                    `Field "${field}" with value ${value} is not empty!`
            );
            logger.evaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// --------------------------------------------------
// evaluate() with OpenAI
// --------------------------------------------------

// TODO: Make it work with groq as well. there should be a completionFn Map as well, so the user always defines the model like: openai/gpt-4o or groq/llama-3.2-70b-instant
export const evaluate = (
    field: string,
    evaluation: string,
    model: string
): IEvaluationFunction => {
    return {
        run: async (state: any): Promise<IActionResult> => {
            const openai = new OpenAI();

            if (!state.hasOwnProperty(field)) {
                return {
                    pass: false,
                    reason: `Evaluation unsuccessful: The last result does not contain the field: ${field}`,
                };
            }

            const value = state[field];
            try {
                const completion = await openai.beta.chat.completions.parse({
                    messages: [
                        {
                            role: "system",
                            content: `You are a helpful evaluator. Does the result satisfy the condition? The condition to evaluate the result: "${evaluation}". The result: ${value}`,
                        },
                    ],
                    model,
                    stream: false,
                    response_format: zodResponseFormat(
                        z.object({
                            final: z.boolean().describe(
                                "true if the result satisfies the condition, false if not."
                            ),
                        }),
                        "evaluation"
                    ),
                });

                const condition =
                    completion.choices[0].message.parsed?.final ?? false; // Default to false if undefined

                const evaluationResult = {
                    pass: condition,
                    reason: condition
                        ? "Evaluation successful"
                        : `Evaluation unsuccessful: Field "${field}" with value ${value} does not satisfy the evaluation task: ${evaluation}`,
                };

                logger.evaluation(field, evaluationResult);
                return evaluationResult;
            } catch (error) {
                console.error("Error in OpenAI request:", error);
                return {
                    pass: false,
                    reason: String(error),
                };
            }
        },
    };
};

// --------------------------------------------------
// Combinators: or() and and()
// --------------------------------------------------

export const or = (
    conditions: Array<{ run: (state: any) => Promise<IActionResult> | IActionResult }>
): IEvaluationFunction => {
    return {
        run: async (state: any) => {
            const results = await Promise.all(
                conditions.map(async (condition) => await condition.run(state))
            );
            const failedEvaluations = results.filter((result) => !result.pass);
            const reasons = failedEvaluations
                .map(
                    (result, index) =>
                        `${index + 1}) ${result.reason.split("Evaluation unsuccessful: ")[1]}`
                )
                .join(" ");
            const pass = results.some((result) => result.pass);

            return {
                pass,
                reason: pass
                    ? "Evaluation successful"
                    : `Evaluation unsuccessful: Reasons:\n\n${reasons}\n\n`,
            };
        },
    };
};

export const and = (
    conditions: Array<{ run: (state: any) => Promise<IActionResult> | IActionResult }>
): IEvaluationFunction => {
    return {
        run: async (state: any) => {
            const results = await Promise.all(
                conditions.map(async (condition) => await condition.run(state))
            );
            const notPassedEvaluations = results.filter((result) => !result.pass);
            const reasons = notPassedEvaluations
                .map(
                    (result, index) =>
                        `${index + 1}) ${result.reason.split("Evaluation unsuccessful: ")[1]}`
                )
                .join(" ");
            const pass = results.every((result) => result.pass);

            return {
                pass,
                reason: pass
                    ? "Evaluation successful"
                    : `Evaluation unsuccessful: Reasons:\n\n${reasons}\n\n`,
            };
        },
    };
};
