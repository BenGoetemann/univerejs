// ====================================
// Basic interfaces for agent instantiation
// ====================================

import { ZodSchema } from "zod";
import { State } from "./base/state";
import { Agent } from "./base/agent";
import { Team } from "./architectures/team";
import { Pipe } from "./architectures/pipe";
import { Graph } from "./base/graph";
import { Vote } from "./architectures/vote";

export enum EModels {
  gpt_4o = "openai/gpt-4o",
  chatgpt_4o_latest = "openai/chatgpt-4o-latest",
  gpt_4o_mini = "openai/gpt-4o-mini",
  o1 = "openai/o1",
  o1_mini = "openai/o1_mini",
  gpt_3_5_turbo = "openai/gpt-3.5-turbo",
  gpt_3_5_turbo_0125 = "openai/gpt-3.5-turbo-0125",
  gpt_3_5_turbo_1106 = "openai/gpt-3.5-turbo-1106",
  gpt_3_5_turbo_instruct = "openai/gpt-3.5-turbo-instruct",
  distil_whisper_large_v3 = "groq/distil-whisper-large-v3-en",
  gemma_2_9b_it = "groq/gemma2-9b-it",
  llama_3_3_70b_versatile = "groq/llama-3.3-70b-versatile",
  llama_3_1_8b_instasnt = "groq/llama-3.1-8b-instant",
  llama_guard_3_8b = "groq/llama-guard-3-8b",
  llama_3_70b_8192 = "groq/llama3-70b-8192",
  llama_3_8b_8192 = "groq/llama3-8b-8192",
  mixtral_8x7b_32768 = "groq/mixtral-8x7b-32768",
  whisper_large_v3 = "groq/whisper-large-v3",
  whisper_large_v3_turbo = "groq/whisper-large-v3-turbo",
}

export type TModels = EModels | string

export enum EOutput {
  JSON = "json",
  TEXT = "text",
  TOOL = "tool_call"
}

export interface IAgent {
  model: TModels;
  retries: number;
  name: string;
  description: string;
  task: string;
  tools?: any[];
  outputType: EOutput;
  lifecycle: ILifecycle;
  outputSchema?: ZodSchema
}

export interface IAgentFactoryOutputProperty {
  name: string,
  type: string,
  description: string,
  enum: string[],
}

export interface IAgentFactory {
  name: string;
  description: string;
  task: string;
  outputProperties: IAgentFactoryOutputProperty[]
}

// ====================================
// Basic interfaces for agent com
// ====================================

export interface IInvocation {
  state: any,
  task: string
}

export interface IMessage {
  name: string // THE NAME OF THE SENDER. RELEVANT FOR SUPERVISOR AGENTS
  role: "user" | "system" | "assistant"
  content: any,
}

// ====================================
// Used for completion functions
// ====================================

// used to input the task and history to model providers
export interface ICompletionInput {
  task: string
  history: IMessage[]
}

// needed for api calling of model providers
export interface ICompletionConfig extends ICompletionInput {
  model: string,
  outputType: EOutput,
  outputSchema: any,
  tools: any[] | undefined,
  name: string,
  lifecycle: ILifecycle
}

// needed to return the result after a evaluation step
export interface ICompletionResult {
  final: boolean
  result: any
}

// ====================================
// Used as output interface for architectures and agents
// ====================================

export interface IResult {
  history: IMessage[],
  state: any
}

// ====================================
// Used for evaluation functions
// ====================================

// defines if a evaluation passed or not, and provides a reason
export interface IActionResult {
  pass: boolean,
  reason: string
}

// definition of the evaluation function 
export interface IEvaluationFunction {
  run: (state: any) => IActionResult | Promise<IActionResult>
}

export interface IStateManipulationFunction {
  run: (result: any, state: State<any>) => IActionResult;
}

export interface IArchitecture {
  _type?: string
  name: string,
  description: string
}

export interface ISupervisor extends IArchitecture {
  model: TModels
  workers: TWorker[]
}

export interface ITeam extends IArchitecture {
  supervisor: Agent
  workers: TWorker[]
}

export interface IPipe extends IArchitecture {
  workers: TWorker[]
}

export interface IGraph extends IArchitecture { }

export interface IVote extends IArchitecture {
  workers: TWorker[]
  synthesizer: Agent
}

export type TWorker = Agent | Team | Pipe | Graph | Vote

export interface IGraphInvocation {
  state: any;
  task: string;
  startNode?: TWorker | "START";
}

export type DirectEdge = {
  type: "direct";
  to: TWorker | string;
};

export type ConditionalEdge = {
  type: "conditional";
  fn: (state: any) => TWorker | string;
};

export type ParallelEdge = {
  type: "parallel"; to: (TWorker | string)[]
  next?: TWorker | string;
}

export type Edge = DirectEdge | ConditionalEdge | ParallelEdge;

export interface IAction {
  state: any
  run: (...params: any) => boolean
}

export interface IStateManipulation extends IAction {
  from: string,
  to: string,
}

export interface IPromptInjections extends IAction {
  prompt: string
}

export interface IEvaluation extends IAction {
  is: boolean
}

export interface ILifecycle {
  beforeRun?: {
    stateManipulations?: any[],
    promptInjections?: any[]
  },
  afterRun: {
    stateManipulations: any[],
    resultEvaluations?: any[]
    stateEvaluations?: any[]
    stopConditions?: any[]
  }
}

export interface ITool {
  name: string,
  functionDefinition: any,
  fn: (...args: any) => any
}

export interface ICustomToolConfig {
  name: string,
  description: string,
  schema: ZodSchema,
  fn: (...args: any) => any
}

export interface IFuncionDefinition {
  type: string,
  function: { name: string, description: string, strict: boolean, parameters: any }
}

export type TObject = Record<string, unknown>;
export type TId = string | number
export type TFunction = (input?: any) => any
export interface ILogger {
  log: (message: string) => string
}

export interface IProviderModelSplit {
  provider: string;
  model: string;
}