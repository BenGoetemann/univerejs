import { ZodSchema } from "zod";

declare global {
  // ====================================
  // Basic interfaces for agent instantiation
  // ====================================

  enum EModels {
    GPT4O = "openai/gpt-4o",
    LLAMA = "groq/llama-3.2-70b",
  }

  enum EAgentType {
    Planning = "planning",
    React = "react",
    ZeroShot = "zero-shot",
  }

  enum EOutput {
    JSON = "json",
    Text = "text",
    Tool = "tool_call"
  }

  interface IAgent {
    _type?: string;
    model: EModels;
    type?: EAgentType;
    retries: number;
    name: string;
    description: string;
    task: string;
    tools?: any[];
    outputType: T;
    lifecycle: ILifecycle;
    outputSchema?: ZodSchema
  }

  interface IAgentFactoryOutputProperty {
    name: string,
    type: string,
    description: string,
    enum: string[],
  }

  interface IAgentFactory {
    name: string;
    description: string;
    task: string;
    outputProperties: IAgentFactoryOutputProperty[]
  }

  // ====================================
  // Basic interfaces for agent com
  // ====================================

  interface IInvocation {
    state: TState,
    task: string
  }

  interface IMessage {
    name: string // THE NAME OF THE SENDER. RELEVANT FOR SUPERVISOR AGENTS
    role: "user" | "system" | "assistant"
    content: any,
  }

  // ====================================
  // Used for completion functions
  // ====================================

  // used to input the task and history to model providers
  interface ICompletionInput {
    task: string
    history: IMessage[]
  }

  // needed for api calling of model providers
  interface ICompletionConfig extends ICompletionInput {
    model: string,
    outputType: EOutput,
    outputSchema: any,
    tools: any[] | undefined,
    name: string,
    lifecycle: ILifecycle
  }

  // needed to return the result after a evaluation step
  interface ICompletionResult {
    final: boolean
    result: any
  }

  // ====================================
  // Used as output interface for architectures and agents
  // ====================================

  interface IResult {
    history: IMessage[],
    state: any
  }

  // ====================================
  // Used for evaluation functions
  // ====================================

  // defines if a evaluation passed or not, and provides a reason
  interface IActionResult {
    pass: boolean,
    reason: string
  }

  // definition of the evaluation function 
  interface IEvaluationFunction {
    run: (state: any) => IActionResult | Promise<IActionResult>
  }

  interface IStateManipulationFunction {
    run: (result: any, state: State<any>) => IActionResult;
  }
  // ====================================
}

export { }; // This ensures it is treated as a module