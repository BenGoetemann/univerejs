import { Graph } from "../base/graph";
import { IInvocation, IResult, IVote, TWorker } from "../types";

export class Vote {
    _type = "vote";
    name: string;
    description: string;
    workers: TWorker[];
    synthesizer: TWorker;

    /**
     * Constructs a new Vote instance with the provided configuration.
     *
     * @param {IVote} config - The configuration object for the vote.
     * @param {string} config.name - The name of the vote.
     * @param {string} [config.description] - The description of the vote.
     * @param {TWorker[]} config.workers - The list of worker agents in the vote.
     * @param {Agent} config.synthesizer - The synthesizer agent for the vote.
     * @throws {Error} - Throws an error if the name is not provided, if the workers array is empty or not provided, or if the synthesizer is not provided.
     */
    constructor(config: IVote) {
        if (!config.name) {
            throw new Error("Vote must have a name.");
        }
        if (!config.workers || !Array.isArray(config.workers) || config.workers.length === 0) {
            throw new Error("Vote must have a non-empty array of worker agents.");
        }
        if (!config.synthesizer) {
            throw new Error("Vote must have a synthesizer agent.");
        }

        this.name = config.name;
        this.description = config.description || "";
        this.workers = config.workers;
        this.synthesizer = config.synthesizer;
    }

    /**
     * Invokes the vote process by creating and executing a graph.
     * The graph starts with a parallel edge from START to all worker agents, leading to the synthesizer.
     * The synthesizer then leads to END. The graph is invoked starting from START.
     * 
     * @param {IInvocation} i - The invocation object containing the state and task.
     * @returns {Promise<IResult>} - A promise that resolves to the result of the graph invocation, including the final state and combined history.
     */
    async invoke(i: IInvocation): Promise<IResult> {
        // 1) Create a new Graph
        const graph = new Graph({
            name: `${this.name}`,
            description: this.description
        });

        // 2) Add parallel edges from START to all worker agents, leading to the synthesizer
        graph.addParallelEdges("START", this.workers, this.synthesizer);

        // 3) Add an edge from the synthesizer to END
        graph.addEdge(this.synthesizer, "END");

        // 4) Invoke the graph starting from START
        const result = await graph.invoke({
            state: i.state,
            task: i.task,
            startNode: "START",
        });

        // 5) Return the combined history and final state
        return {
            history: result.history,
            state: result.state,
        };
    }
}
