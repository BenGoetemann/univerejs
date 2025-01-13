import { ZodSchema } from "zod"; // Ensure zod is installed

declare global {
    interface IState {
        schema: ZodSchema;
        state?: any;
    }
    
}

export { }; // This ensures it is treated as a module