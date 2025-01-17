declare global {
    interface ITool {
        name: string,
        functionDefinition: any,
        fn: (...args: any) => any
    }

    interface ICustomToolConfig {
        name: string,
        description: string,
        schema: ZodSchema,
        fn: (...args: any) => any
    }

    interface IFuncionDefinition {
        type: string,
        function: { name: string, description: string, strict: boolean, parameters: any }
    }

}

export { }; // This ensures it is treated as a module