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