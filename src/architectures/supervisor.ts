// supervisor.ts (refactored for readability and maintainability)

import { z, ZodType } from "zod";
import { jsonSchemaToZod } from "json-schema-to-zod";

import { Agent } from "../base/agent";
import { Graph } from "../base/graph";
import { State } from "../base/state";
import { Logger } from "../helper/logger";

import { chooseBetween, focusOn, isSet, set } from "../lifecycles";
import { Pipe } from "./pipe";
/** 
 * The SupervisorState shape 
 */
interface SupervisorState {
    nodes: string[] | undefined;
    edges: Array<{
        from: string;
        to: string | string[];
        type: "direct" | "conditional" | "parallel";
        conditionFn?: string;
        parallelNext?: string;
    }> | undefined;
    additionalWorkers: IAgentFactory[] | undefined
}

// Zod Schemas
// --------------------------------------------------------------------------------
const supervisorOutputSchema = z.object({
    nodes: z.array(z.string()).describe("List of agent names to include in the graph"),
    edges: z.array(z.object({
        from: z.string(),
        to: z.union([z.string(), z.array(z.string())]).optional().describe("Only relevant for parallel and direct edges."),
        type: z.enum(["direct", "conditional", "parallel"]),
        conditionFn: z.string().optional(),
        parallelNext: z.string().optional(),
    })).describe("Edges defining the connections between agents"),
});

const agentFactoryOutputSchema = z.object({
    additionalWorkers: z.array(z.object({
        name: z.string().describe("the name of the agent"),
        description: z.string().describe("the description of the agent"),
        task: z.string().describe("the task of the agent"),
        outputProperties: z.array(z.object({
            name: z.string().describe("the name of this property"),
            type: z.enum(["string", "boolean", "number"]),
            description: z.string().describe("the description of this property"),
            enum: z.array(z.string().describe("the allowed enum values")).optional()
        }))
    }))
});

// Prompt for the Supervisor Agent
// --------------------------------------------------------------------------------
const SUPERVISOR_PROMPT = `
You are the Supervisor Agent. Your task is to create a workflow graph that defines 
the sequence in which agents should be invoked to accomplish the user's task.

Please provide a JSON object with the structure as shown in this example:

\`\`\`json
{
    "nodes": ["agent_1", "agent_2", "agent_3", "agent_4", "reporter_agent"],
    "edges": [
        // Start Edge Example
        { 
            "from": "START", 
            "to": "agent_1", 
            "type": "direct" 
        },
        // Direct Edge Example
        { 
            "from": "agent_1", 
            "to": "agent_2", 
            "type": "direct" 
        },
        // Conditional Edge Example
        { 
            "from": "agent_1", 
            "type": "conditional", 
            "conditionFn": "function(state) { if(state.xyz === 'abc') { return 'agent_2'; } return 'agent_3'; }" 
        },
        // Parallel Edge Example
        { 
            "from": "agent_1", 
            "to": ["agent_2", "agent_3", "agent_4"], 
            "type": "parallel", 
            "parallelNext": "agent_4" 
        },
        // Final Edge to End
        { 
            "from": "reporter_agent", 
            "to": "END", 
            "type": "direct" 
        }
    ]
}
\`\`\`

Ensure that:
- All agents referenced in "edges" are included in the "nodes" array.
- If there is no subsequent node after a parallel edge, set "parallelNext" to "END".
- Use arrays for the "to" field in parallel edges to specify multiple agents.
- Include edges from "START" to initial agents to define entry points.
- Provide examples for all edge types: "direct", "conditional", and "parallel".
- Only use condition function code strings that define functions taking "state" and returning the next agent's name.
- IF A CONDITIONAL EDGE IS CREATED, YOU CAN CREATE A FROM AGENT, THAT IS NOT YET EXISTENT.

IMPORTANT: THINK ABOUT WHAT A GRAPH WOULD LOOK LIKE TO SATISFY THE USERS TASK. 
YOU DONT HAVE TO USE EVERY EDGE TYPE AT YOUR EXPOSAL. USE THE EASIEST WAY TO SATISFY THE USERS TASK. 
TRY TO AVOID DUPLICATE EDGES!

This is a bad example, because the parallel edges do everything at once, 
no direct edges are needed to invoke the x_agent, because the logic is duplicated, that is already achieved in the parallel edge:

\`\`\`json
{
  "nodes": [
    "agent_1",
    "agent_2",
    "agent_3",
    "agent_4",
    "x_agent"
  ],
  "edges": [
    {
      "from": "START",
      "to": [
        "agent_1",
        "agent_2",
        "agent_3",
        "agent_4"
      ],
      "type": "parallel",
      "conditionFn": "",
      "parallelNext": "x_agent"
    },
    {
      "from": "agent_1",
      "to": "x_agent",
      "type": "direct",
      "conditionFn": "",
      "parallelNext": ""
    },
    {
      "from": "agent_2",
      "to": "x_agent",
      "type": "direct",
      "conditionFn": "",
      "parallelNext": ""
    },
    {
      "from": "agent_3",
      "to": "x_agent",
      "type": "direct",
      "conditionFn": "",
      "parallelNext": ""
    },
    {
      "from": "agent_4",
      "to": "x_agent",
      "type": "direct",
      "conditionFn": "",
      "parallelNext": ""
    },
    {
      "from": "x_agent",
      "to": "END",
      "type": "direct",
      "conditionFn": "",
      "parallelNext": ""
    }
  ]
}
\`\`\`
`;

// Prompt for the Agent Factory
// --------------------------------------------------------------------------------
const AGENT_FACTORY_PROMPT = `
When your graph includes one or more **conditional edges** that reference a worker 
**not** defined in your nodes list (excluding **START** and **END**), you must create 
an additional worker definition for each such worker.

### Example

- **Nodes list**: ['agent_1', 'agent_2', 'agent_3']
- **Conditional edge** in the graph:
\`\`\`json
{
    "from": "x_agent",
    "type": "conditional",
    "conditionFn": "function(state) { if (state.x === 'x') { return 'agent_1'; } else if (state.x === 'y') { return 'agent_2'; } return 'agent_3'; }",
    "parallelNext": ""
}
\`\`\`

Because "x_agent" is not in the nodes list (and is not START or END), 
you should create a worker definition such as:

\`\`\`json
{
    "name": "x_agent",
    "description": "A brief description of this worker",
    "task": "A description of the task to be completed",
    "outputProperties": [
        {
            "name": "x",
            "type": "string",
            "description": "Details about this output property",
            "enum": ["x", "y"]
        }
    ]
}
\`\`\`
`;

/**
 * Supervisor Class
 * --------------------------------------------------------------------------------
 * Responsible for creating a workflow graph of agents based on the user's task.
 * Invokes two internal Agents:
 *  1) The "supervisor" agent to generate the graph structure
 *  2) The "agent_factory" agent to create missing (conditionally referenced) agents
 *
 * Finally, it spawns any additional agents and constructs a Graph to invoke them.
 */
export class Supervisor {
    _type = "supervisor";
    name: string;
    description: string;
    model: EModels;
    workers: TWorker[];
    logger: Logger;

    constructor(config: ISupervisor) {
        this.name = config.name;
        this.description = config.description;
        this.workers = config.worker;
        this.logger = new Logger();
        this.model = config.model;
    }

    /**
     * Main entry point: invokes the Supervisor architecture.
     * 1) Builds the graph structure via the Supervisor Agent
     * 2) Creates any additional missing agents via the Agent Factory
     * 3) Spawns and adds those agents to the workers list
     * 4) Builds and invokes the final Graph
     *
     * @param invocation IInvocation object containing state, task, etc.
     * @returns IResult with combined history and updated state.
     */
    async invoke(invocation: IInvocation): Promise<IResult> {
        // 1. Prepare a shared state for the Supervisor
        const supervisorState = this.createSupervisorState();

        // 2. Prepare Agents
        const supervisorAgent = this.createSupervisorAgent(supervisorState);
        const agentFactoryAgent = this.createAgentFactoryAgent(supervisorState);

        // 3. Pipe them in sequence
        const supervisorPipe = new Pipe({
            name: "supervisor_pipe",
            description: "Executes supervisor -> agent factory pipeline",
            worker: [supervisorAgent, agentFactoryAgent],
        });

        await supervisorPipe.invoke({
            state: supervisorState,
            task: invocation.task,
        });

        // 4. After pipeline: spawn additional workers if any
        await this.spawnAdditionalWorkers(supervisorState);

        // 5. Build the graph and invoke it
        const result = await this.buildAndInvokeGraph(supervisorState, invocation);

        // 6. Combine supervisor's and final graph's histories
        const combinedHistory = [...supervisorAgent.history, ...result.history];

        return {
            history: combinedHistory,
            state: result.state,
        };
    }

    /**
     * Creates the initial SupervisorState object with empty fields.
     */
    private createSupervisorState(): State<SupervisorState> {
        return new State<SupervisorState>({
            nodes: undefined,
            edges: undefined,
            additionalWorkers: undefined
        });
    }

    /**
     * Creates the Supervisor Agent that is responsible for generating the graph structure.
     */
    private createSupervisorAgent(supervisorState: State<SupervisorState>): Agent {
        return new Agent({
            name: "supervisor",
            description: "Creates a graph of agents to be invoked.",
            task: SUPERVISOR_PROMPT,
            retries: 2,
            model: this.model,
            outputType: "json",
            outputSchema: supervisorOutputSchema,
            lifecycle: {
                beforeRun: {
                    promptInjections: [
                        chooseBetween(this.workers)
                        // Optionally add more structured prompts here
                    ]
                },
                afterRun: {
                    resultEvaluations: [isSet("nodes"), isSet("edges")],
                    stateManipulations: [set("nodes"), set("edges")]
                }
            }
        });
    }

    /**
     * Creates the Agent Factory to define any additional workers not originally included.
     */
    private createAgentFactoryAgent(supervisorState: State<SupervisorState>): Agent {
        return new Agent({
            name: "agent_factory",
            description: "Creates agents that are not yet instantiated, required by conditional edges.",
            task: AGENT_FACTORY_PROMPT,
            retries: 2,
            model: this.model,
            outputType: "json",
            outputSchema: agentFactoryOutputSchema,
            lifecycle: {
                beforeRun: {
                    promptInjections: [focusOn("edges"), focusOn("nodes")]
                },
                afterRun: {
                    resultEvaluations: [isSet("additionalWorkers")],
                    stateManipulations: [set("additionalWorkers")]
                }
            }
        });
    }

    /**
     * Spawns additional workers returned by the agent factory and appends them to this Supervisor's workers list.
     */
    private async spawnAdditionalWorkers(supervisorState: State<SupervisorState>): Promise<void> {
        const additionalWorkers = supervisorState.getState().additionalWorkers;
        if (!additionalWorkers) return;

        for (const workerDefinition of additionalWorkers) {
            const outputSchema = this.buildOutputSchema(workerDefinition.outputProperties);

            const worker = new Agent({
                name: workerDefinition.name,
                description: workerDefinition.description,
                task: workerDefinition.task,
                retries: 2,
                model: this.model,
                outputType: "json",
                outputSchema,
                lifecycle: {
                    afterRun: {
                        resultEvaluations: workerDefinition.outputProperties.map((p) => isSet(p.name)),
                        stateManipulations: workerDefinition.outputProperties.map((p) => set(p.name))
                    }
                }
            });

            this.workers.push(worker);
        }
    }

    /**
     * Dynamically builds a Zod output schema for newly created workers based on their output properties.
     */
    private buildOutputSchema(outputProperties: IAgentFactoryOutputProperty[]): ZodType<any> {
        const jsonSchema = {
            type: "object",
            properties: outputProperties.reduce((acc: any, property) => {
                acc[property.name] = {
                    type: property.type,
                    description: property.description,
                    enum: property.enum
                };
                return acc;
            }, {}),
            additionalProperties: false,
            required: outputProperties.map((p) => p.name)
        };

        // Convert JSON schema to Zod schema
        return eval(jsonSchemaToZod(jsonSchema, { module: "cjs" }));
    }

    /**
     * Builds the final Graph from the supervisorState nodes/edges and invokes it.
     */
    private async buildAndInvokeGraph(
        supervisorState: State<SupervisorState>,
        invocation: IInvocation
    ): Promise<IResult> {
        const { nodes, edges } = supervisorState.getState();
        if (!nodes || !edges) {
            throw new Error(`Supervisor Agent did not set the "nodes" or "edges" in the state.`);
        }

        const graph = new Graph({
            name: `${this.name}-graph`,
            description: this.description,
        });

        // Add all edges to the graph
        edges.forEach((edge) => {
            const { from, to, type, conditionFn, parallelNext } = edge;
            const fromNode = this.getNodeOrControl(from);

            switch (type) {
                case "direct":
                    if (typeof to !== "string") {
                        throw new Error(`Direct edge "to" field must be a string.`);
                    }
                    const toNodeDirect = this.getNodeOrControl(to);
                    console.log(`Adding direct edge from "${fromNode}" to "${toNodeDirect}".`);
                    graph.addEdge(fromNode, toNodeDirect);
                    break;

                case "conditional":
                    if (!conditionFn) {
                        throw new Error(`Conditional edge missing "conditionFn".`);
                    }
                    if (typeof conditionFn !== "string") {
                        throw new Error(`Conditional edge "conditionFn" must be a string.`);
                    }
                    this.addConditionalEdge(graph, fromNode, conditionFn);
                    break;

                case "parallel":
                    if (!Array.isArray(to)) {
                        throw new Error(`Parallel edge "to" field must be an array.`);
                    }
                    const toNodesParallel = to.map((nodeName: string) => this.getNodeOrControl(nodeName));
                    const nextNode = (parallelNext && parallelNext.trim() !== "")
                        ? this.getNodeOrControl(parallelNext)
                        : "END";
                    console.log(`Adding parallel edge from "${fromNode}" to "${toNodesParallel.join(", ")}" with next node "${nextNode}".`);
                    graph.addParallelEdges(fromNode, toNodesParallel, nextNode);
                    break;

                default:
                    throw new Error(`Unknown edge type "${type}"`);
            }
        });

        // Determine initial nodes (ones with no incoming edges) and connect them from "START"
        const initialNodes = this.findInitialNodes(nodes, edges);
        initialNodes.forEach((node) => {
            const nodeMapped = this.getNodeOrControl(node);
            console.log(`Adding edge from "START" to "${nodeMapped}".`);
            graph.addEdge("START", nodeMapped);
        });

        // Finally, invoke the graph
        return graph.invoke({
            state: invocation.state,
            task: invocation.task,
            startNode: "START",
        });
    }

    /**
     * Helper to get a node's corresponding worker or return the string control node (START/END).
     */
    private getNodeOrControl(nodeName: string): TWorker | string {
        if (nodeName === "START" || nodeName === "END") {
            return nodeName;
        }
        const worker = this.workers.find((w) => w.name === nodeName);
        if (!worker) {
            throw new Error(`Worker with name "${nodeName}" not found in Supervisor's workers.`);
        }
        return worker;
    }

    /**
     * Helper to parse and add a conditional edge function to the Graph.
     */
    private addConditionalEdge(graph: Graph, fromNode: TWorker | string, conditionFn: string) {
        try {
            const rawFunction = eval(`(${conditionFn})`);
            if (typeof rawFunction !== "function") {
                throw new Error(`Parsed conditionFn is not a function.`);
            }

            // Wrap it: convert the returned string -> actual agent object (or "END"/"START")
            const conditionFunction: (state: any) => TWorker | string = (state) => {
                const returnedName = rawFunction(state);
                if (returnedName === "END" || returnedName === "START") {
                    return returnedName;
                }
                const agent = this.workers.find((w) => w.name === returnedName);
                if (!agent) {
                    throw new Error(
                        `Conditional function returned name "${returnedName}" but no worker with that name was found.`
                    );
                }
                return agent;
            };

            console.log(`Adding conditional edge from "${fromNode}" with condition function.`);
            graph.addConditionalEdge(fromNode, conditionFunction);
        } catch (error) {
            throw new Error(`Error parsing conditionFn: ${(error as Error).message}`);
        }
    }

    /**
     * Finds nodes that have no incoming edges (based on the edges list).
     */
    private findInitialNodes(allNodes: string[], edges: SupervisorState["edges"]): string[] {
        return allNodes.filter((node) => {
            return !edges?.some((edge) => {
                if (Array.isArray(edge.to)) {
                    return edge.to.includes(node);
                }
                return edge.to === node;
            });
        });
    }
}
