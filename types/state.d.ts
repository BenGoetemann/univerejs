import { ZodSchema } from "zod"; // Ensure zod is installed
import { State } from "../src";

declare global {
    type TState = State

}

export { }; // This ensures it is treated as a module