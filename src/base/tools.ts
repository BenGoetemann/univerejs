import { z, ZodSchema } from "zod"
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ICustomToolConfig, IFuncionDefinition, ITool } from "../types";

const createFunctionDefinition = (name: string, description: string, schema: ZodSchema): IFuncionDefinition => {
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
 * Creates a new tool based on the provided configuration.
 * 
 * @param {ICustomToolConfig} i - The configuration object for the tool.
 * @param {string} i.name - The name of the tool.
 * @param {string} i.description - The description of the tool.
 * @param {ZodSchema} i.schema - The schema for the tool's parameters.
 * @param {(...args: any) => any} i.fn - The function to be executed by the tool.
 * @returns {ITool} - The created tool object.
 */
export const createTool = (i: ICustomToolConfig): ITool => {
    return {
        name: i.name,
        functionDefinition: createFunctionDefinition(i.name, i.description, i.schema),
        fn: i.fn
    }
}

// export const helloWorldTool = (): ITool => {
//     return {
//         name: "hello world",
//         functionDefinition: createFunctionDefinition("hello world tool", "hello world tool", z.object({
//             hello: z.string().describe('world')
//         })),
//         fn: () => {
//             console.log("Hello World")
//         }
//     }
// }