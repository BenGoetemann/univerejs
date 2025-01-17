import { z, ZodSchema } from "zod"
import { zodToJsonSchema } from 'zod-to-json-schema';

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

export const createTool = (i: ICustomToolConfig): ITool => {
    return {
        name: i.name,
        functionDefinition: createFunctionDefinition(i.name, i.description, i.schema),
        fn: i.fn
    }
}

export const helloWorldTool = (): ITool => {
    return {
        name: "hello world",
        functionDefinition: createFunctionDefinition("hello world tool", "hello world tool", z.object({
            hello: z.string().describe('world')
        })),
        fn: () => {
            console.log("Hello World")
        }
    }
}