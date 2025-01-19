import { Graph } from "../base/graph";
import { IInvocation, IPipe, IResult, TWorker } from "../types";

export class Pipe {
    _type = "pipe";

    workers: TWorker[]; // Contains instances, not plain objects
    name: string;
    description: string;

    /**
     * Initializes a new instance of the Pipe class.
     * 
     * This constructor takes a configuration object for the pipe and sets up the pipe's properties.
     * It ensures that the workers property contains instances of workers, not just configuration objects.
     * 
     * @param {IPipe} pipeConfig - The configuration object for the pipe.
     * @param {TWorker[]} pipeConfig.workers - An array of worker instances.
     * @param {string} pipeConfig.name - The name of the pipe.
     * @param {string} pipeConfig.description - A description of the pipe.
     */
    constructor(pipeConfig: IPipe) {
        this.workers = pipeConfig.workers; // Make sure `pipe` contains instances, not config objects
        this.name = pipeConfig.name;
        this.description = pipeConfig.description;
    }

    /**
     * Initiates the invocation process for the pipe.
     * 
     * This method orchestrates the entire process of handling the invocation, including
     * prompt injections, result evaluations, and state manipulations. It iterates through
     * the configured workers to ensure the pipe produces a final output.
     * 
     * @param {IInvocation} i - The invocation object containing the state and task.
     * @returns {Promise<IResult>} A promise that resolves to the final result of the invocation.
     */
    async invoke(i: IInvocation): Promise<IResult> {
        // 1) Create a new Graph
        const graph = new Graph({
            name: "pipe_graph",
            description: "the graph of a pipe"
        });

        // 2) We'll chain from "START" -> agentOrPipe1 -> agentOrPipe2 -> ... -> "END"
        let prevNode: string | TWorker = "START";

        for (const instanceObject of this.workers) {
            // console.dir(instanceObject, { depth: null }); // Verify that it is already an instance

            // Add a direct edge from the previous node to the instance
            graph.addEdge(prevNode, instanceObject);

            // Update the "previous node" pointer
            prevNode = instanceObject;
        }

        // 3) Finally, add a direct edge from the last agent or pipe to "END"
        graph.addEdge(prevNode, "END");

        // 4) Invoke the graph
        const result = await graph.invoke({
            state: i.state,
            task: i.task,
            startNode: "START",
        });

        // 5) The Graph already returns a combined `history` plus updated `state`.
        return {
            history: result.history,
            state: result.state,
        };
    }
}
