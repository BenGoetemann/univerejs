import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { Logger } from "../helper/logger";
import _ from "lodash"; // Lodash import
import { IActionResult, IEvaluationFunction } from "../types";

// TODO: Implement nested evaluation like weather.humidity

// --------------------------------------------------
// Shared logger instance
// --------------------------------------------------

/**
 * Shared logger instance for logging evaluation results.
 */
const logger = new Logger();

// --------------------------------------------------
// Helper to standardize the evaluation pattern
// --------------------------------------------------

/**
 * Runs an evaluation on a specific field within the result.
 *
 * @param {any} result - The result object to evaluate.
 * @param {string} field - The field within the result to evaluate.
 * @param {(value: any) => boolean} conditionFn - Function to determine if the value satisfies the condition.
 * @param {(value: any) => string} errorMsgFn - Function to generate an error message if the condition fails.
 * @returns {IActionResult} The outcome of the evaluation.
 */
function runEvaluation(
    result: any,
    field: string,
    conditionFn: (value: any) => boolean,
    errorMsgFn: (value: any) => string
): IActionResult {
    // 1) Check field existence using Lodash _.get
    const value = _.get(result, field);

    if (value === undefined) {
        return {
            pass: false,
            reason: `Evaluation unsuccessful: The field "${field}" does not exist in the result.`,
        };
    }

    // 2) Evaluate condition
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

/**
 * Creates an evaluation function to check if a field is set.
 *
 * @param {string} field - The field to check.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const isSet = (field: string): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) =>
                    Array.isArray(value)
                        ? value.length > 0
                        : value !== undefined && value !== null,
                () => `Field "${field}" is not set!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field's value is greater than a specified number.
 *
 * @param {string} field - The field to evaluate.
 * @param {number} x - The number to compare against.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const gt = (field: string, x: number): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) =>
                    (Array.isArray(value) && value.length > x) ||
                    (typeof value === "number" && value > x),
                (value) => `Field "${field}" with value ${value} is not greater than ${x}!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field's value is less than a specified number.
 *
 * @param {string} field - The field to evaluate.
 * @param {number} x - The number to compare against.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const lt = (field: string, x: number): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) =>
                    (Array.isArray(value) && value.length < x) ||
                    (typeof value === "number" && value < x),
                (value) => `Field "${field}" with value ${value} is not less than ${x}!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field's value is equal to a specified value.
 *
 * @param {string} field - The field to evaluate.
 * @param {any} x - The value to compare against.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const eq = (field: string, x: any): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) => value === x,
                (value) => `Field "${field}" with value ${value} is not equal to ${x}!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field's value is not equal to a specified value.
 *
 * @param {string} field - The field to evaluate.
 * @param {any} x - The value to compare against.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const neq = (field: string, x: any): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) => value !== x,
                (value) => `Field "${field}" with value ${value} is equal to ${x}!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field contains a specific element.
 *
 * @param {string} field - The field to evaluate.
 * @param {any} element - The element to check for.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const contains = (field: string, element: any): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
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
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field is not empty.
 *
 * @param {string} field - The field to evaluate.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const notEmpty = (field: string): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) =>
                    (Array.isArray(value) || typeof value === "string") &&
                    value.length > 0,
                () => `Field "${field}" is empty!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field's value is greater than or equal to a specified number.
 *
 * @param {string} field - The field to evaluate.
 * @param {number} x - The number to compare against.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const gte = (field: string, x: number): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) =>
                    (Array.isArray(value) && value.length >= x) ||
                    (typeof value === "number" && value >= x),
                (value) =>
                    `Field "${field}" with value ${value} is not greater than or equal to ${x}!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field's value is less than or equal to a specified number.
 *
 * @param {string} field - The field to evaluate.
 * @param {number} x - The number to compare against.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const lte = (field: string, x: number): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) =>
                    (Array.isArray(value) && value.length <= x) ||
                    (typeof value === "number" && value <= x),
                (value) =>
                    `Field "${field}" with value ${value} is not less than or equal to ${x}!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field's value is between two specified numbers.
 *
 * @param {string} field - The field to evaluate.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const between = (field: string, min: number, max: number): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) =>
                    (typeof value === "number" && value >= min && value <= max) ||
                    (Array.isArray(value) && value.length >= min && value.length <= max),
                (value) =>
                    `Field "${field}" with value ${value} is not between ${min} and ${max}!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field's string value starts with a specified prefix.
 *
 * @param {string} field - The field to evaluate.
 * @param {string} prefix - The prefix to check for.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const startsWith = (field: string, prefix: string): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) => typeof value === "string" && value.startsWith(prefix),
                (value) =>
                    `Field "${field}" with value ${value} does not start with ${prefix}!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field's string value ends with a specified suffix.
 *
 * @param {string} field - The field to evaluate.
 * @param {string} suffix - The suffix to check for.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const endsWith = (field: string, suffix: string): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) => typeof value === "string" && value.endsWith(suffix),
                (value) =>
                    `Field "${field}" with value ${value} does not end with ${suffix}!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field's string value matches a specified regular expression.
 *
 * @param {string} field - The field to evaluate.
 * @param {RegExp} regex - The regular expression to test against.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const matches = (field: string, regex: RegExp): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) => typeof value === "string" && regex.test(value),
                (value) =>
                    `Field "${field}" with value ${value} does not match regex ${regex}!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field does not contain a specific element.
 *
 * @param {string} field - The field to evaluate.
 * @param {any} element - The element to check for absence.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const notContains = (field: string, element: any): IEvaluationFunction => {
    return {
        run: (result: any) => {
            const evaluationResult = runEvaluation(
                result,
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
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

/**
 * Creates an evaluation function to check if a field is empty.
 *
 * @param {string} field - The field to evaluate.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const isEmpty = (field: string): IEvaluationFunction => {
    return {
        run: (result: any) => {
            // Special logic: if field doesn't exist at all, we consider it pass: true
            if (!result.hasOwnProperty(field)) {
                const evaluationResult = {
                    pass: true,
                    reason: "Evaluation successful",
                };
                logger.resultEvaluation(field, evaluationResult);
                return evaluationResult;
            }

            // If the field exists, run normal check
            const evaluationResult = runEvaluation(
                result,
                field,
                (value) =>
                    (Array.isArray(value) || typeof value === "string") &&
                    value.length === 0,
                (value) =>
                    `Field "${field}" with value ${value} is not empty!`
            );
            logger.resultEvaluation(field, evaluationResult);
            return evaluationResult;
        },
    };
};

// --------------------------------------------------
// evaluate() with OpenAI
// --------------------------------------------------

/**
 * Creates an evaluation function that uses OpenAI to evaluate a field against a condition.
 *
 * @param {string} field - The field to evaluate.
 * @param {string} evaluation - The condition to evaluate the field against.
 * @param {string} model - The OpenAI model to use for evaluation.
 * @returns {IEvaluationFunction} The evaluation function.
 */
export const evaluate = (
    field: string,
    evaluation: string,
    model: string
): IEvaluationFunction => {
    return {
        run: async (result: any): Promise<IActionResult> => {
            const openai = new OpenAI();

            if (!result.hasOwnProperty(field)) {
                return {
                    pass: false,
                    reason: `Evaluation unsuccessful: The last result does not contain the field: ${field}`,
                };
            }

            const value = result[field];
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

                logger.resultEvaluation(field, evaluationResult);
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

/**
 * Combines multiple evaluation functions using a logical OR. The combined evaluation passes if any of the conditions pass.
 *
 * @param {Array<{ run: (result: any) => Promise<IActionResult> | IActionResult }>} conditions - The conditions to combine.
 * @returns {IEvaluationFunction} The combined evaluation function.
 */
export const or = (
    conditions: Array<{ run: (result: any) => Promise<IActionResult> | IActionResult }>
): IEvaluationFunction => {
    return {
        run: async (result: any) => {
            const results = await Promise.all(
                conditions.map(async (condition) => await condition.run(result))
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

/**
 * Combines multiple evaluation functions using a logical AND. The combined evaluation passes only if all conditions pass.
 *
 * @param {Array<{ run: (result: any) => Promise<IActionResult> | IActionResult }>} conditions - The conditions to combine.
 * @returns {IEvaluationFunction} The combined evaluation function.
 */
export const and = (
    conditions: Array<{ run: (result: any) => Promise<IActionResult> | IActionResult }>
): IEvaluationFunction => {
    return {
        run: async (result: any) => {
            const results = await Promise.all(
                conditions.map(async (condition) => await condition.run(result))
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
