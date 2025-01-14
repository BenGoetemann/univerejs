import { ZodSchema } from "zod"
import { zodToJsonSchema } from 'zod-to-json-schema';

const createFunctionDefinition = (name: string, description: string, schema: ZodSchema) => {
    return {
        type: "function",
        function: {
            name,
            description,
            strict: true,
            parameters: zodToJsonSchema(schema)
        },
    }
}
/**
 * Create your own tool by providing the necessary details.
 * 
 * @param {Object} i - The tool definition object.
 * @param {string} i.name - The name of the tool.
 * @param {string} i.description - A description of what the tool does.
 * @param {ZodSchema} i.schema - The Zod schema defining the tool's parameters.
 * @param {Function} i.fn - The function that implements the tool's functionality.
 * @returns {Object} The created tool object.
 */
export const createTool = (i: {
    name: string,
    description: string,
    schema: any,
    fn: (...args: any) => any
}) => {
    return {
        name: i.name,
        functionDefinition: createFunctionDefinition(i.name, i.description, i.schema),
        fn: i.fn
    }
}