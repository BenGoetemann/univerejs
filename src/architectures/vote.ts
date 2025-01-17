import { Graph } from "../base/graph";

export class Vote {
    _type = "vote";
    name: string;
    description: string;
    worker: TWorker[];
    synthesizer: TWorker;

    constructor(config: IVote) {
        if (!config.name) {
            throw new Error("Vote must have a name.");
        }
        if (!config.worker || !Array.isArray(config.worker) || config.worker.length === 0) {
            throw new Error("Vote must have a non-empty array of worker agents.");
        }
        if (!config.synthesizer) {
            throw new Error("Vote must have a synthesizer agent.");
        }

        this.name = config.name;
        this.description = config.description || "";
        this.worker = config.worker;
        this.synthesizer = config.synthesizer;
    }

    async invoke(i: IInvocation): Promise<IResult> {
        // 1) Create a new Graph
        const graph = new Graph({
            name: `${this.name}`,
            description: this.description
        });

        // 2) Add parallel edges from START to all worker agents, leading to the synthesizer
        graph.addParallelEdges("START", this.worker, this.synthesizer);

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
