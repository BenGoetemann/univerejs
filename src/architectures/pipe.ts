import { Agent } from "../base/agent";
import { Graph } from "../base/graph"; // wherever your new Graph class is

export class Pipe {
    _type = "pipe";

    retries: number;
    pipe: (IAgent | IPipe)[];

    constructor(pipeConfig: IPipe) {
        this.retries = pipeConfig.retries;
        this.pipe = pipeConfig.pipe;
    }

    async invoke(i: IInvocation): Promise<IResult> {
        // 1) Create a new Graph
        const graph = new Graph();

        // 2) We'll chain from "START" -> agent1 -> agent2 -> ... -> "END"
        let prevNode: string | Agent = "START";

        for (const instance of this.pipe) {
            if (instance._type === "agent") {
                // Instantiate the agent
                const agentInstance = new Agent(instance as IAgent);

                // Add a direct edge from the previous node to this agent
                graph.addEdge(prevNode, agentInstance);

                // Update the "previous node" pointer
                prevNode = agentInstance;
            } else if (instance._type === "pipe") {
                // (Optional) Handle nested pipes if needed.
                // For simplicity, you might just ignore them or throw an error,
                // or recursively build a subgraph. Example:
                // const nested = new Pipe(instance as IPipe);
                // ...
            }
        }

        // 3) Finally, add a direct edge from the last agent to "END"
        graph.addEdge(prevNode, "END");

        // 4) Invoke the graph
        const result = await graph.invoke({
            state: i.state,
            startNode: "START",
        });

        // 5) The Graph already returns a combined `history` plus updated `state`.
        return {
            history: result.history,
            state: result.state,
        };
    }
}
