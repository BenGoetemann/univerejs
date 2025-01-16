import { Agent } from "../base/agent";
import { Graph } from "../base/graph";
import { Team } from "./team";

export class Pipe {
    _type = "pipe";

    worker: TWorker[]; // Contains instances, not plain objects
    name: string;
    description: string;

    constructor(pipeConfig: IPipe) {
        this.worker = pipeConfig.worker; // Make sure `pipe` contains instances, not config objects
        this.name = pipeConfig.name;
        this.description = pipeConfig.description;
    }

    async invoke(i: IInvocation): Promise<IResult> {
        // 1) Create a new Graph
        const graph = new Graph({
            name: "pipe_graph",
            description: "the graph of a pipe",
        });

        // 2) We'll chain from "START" -> agentOrPipe1 -> agentOrPipe2 -> ... -> "END"
        let prevNode: string | TWorker = "START";

        for (const instanceObject of this.worker) {
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
