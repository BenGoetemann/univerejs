import { Agent } from "./agent";
import { Logger } from "../misc/logger";

const logger = new Logger();

export class Graph {
    /**
     * We'll store edges in a Map:
     *   key: a node (string | Agent)
     *   value: an array of Edge descriptors
     */
    private edges = new Map<Agent | string, Edge[]>();

    /**
     * Helper to safely retrieve or create the edge list for `fromNode`.
     */
    private getOrCreateEdges(fromNode: Agent | string): Edge[] {
        if (!this.edges.has(fromNode)) {
            this.edges.set(fromNode, []);
        }
        return this.edges.get(fromNode)!;
    }

    /**
     * Add a direct edge: always go from `from` to `to`.
     */
    public addEdge(from: Agent | string, to: Agent | string) {
        const list = this.getOrCreateEdges(from);
        list.push({ type: "direct", to });
        return this; // allow chaining
    }

    /**
     * Add a conditional edge: calls `fn(state)` to decide the next node.
     */
    public addConditionalEdge(from: Agent | string, fn: (state: any) => Agent | string) {
        const list = this.getOrCreateEdges(from);
        list.push({ type: "conditional", fn });
        return this;
    }

    /**
     * Internal helper to pick the "next" node for a given edge,
     * given the current `state`.
     */
    private getNextNodeFromEdge(edge: Edge, state: any): Agent | string | null {
        switch (edge.type) {
            case "direct":
                return edge.to;
            case "conditional":
                return edge.fn(state);
        }
    }

    /**
     * Another helper to pick the FIRST valid next node
     * from all the edge descriptors attached to the current node.
     */
    private pickNextNode(edges: Edge[], state: any): Agent | string | null {
        for (const edge of edges) {
            const next = this.getNextNodeFromEdge(edge, state);
            if (next != null) {
                // Once we find something valid, we use it.
                return next;
            }
        }
        // If no edge returned anything, return null
        return null;
    }

    /**
     * Invoke the graph by starting from `startNode` (default = "START").
     * We'll loop until we reach "END" or have nowhere else to go.
     * We'll also accumulate the "combined history" from each Agent invocation.
     */
    public async invoke({
        state,
        startNode = "START",
    }: {
        state: any;
        startNode?: Agent | string;
    }): Promise<IResult> {
        // 1) We'll accumulate the history from all Agents here
        const combinedHistory: IMessage[] = [];

        let currentNode: Agent | string = startNode;

        while (true) {
            // End condition
            if (currentNode === "END") {
                console.log("Reached END");
                break;
            }

            // If it's an Agent, we call its invoke method.
            if (typeof currentNode !== "string") {
                // we assume it's an Agent instance

                const result = await currentNode.invoke({ state });

                // If agent returned an updated state, carry it forward
                if (result?.state) {
                    state = result.state;
                }

                // If agent returned new history items, push them
                if (result?.history?.length) {
                    combinedHistory.push(...result.history);
                }
            }

            // Get the edges for the current node
            const edgeList = this.edges.get(currentNode) || [];
            if (edgeList.length === 0) {
                console.log(`No edges found for node "${String(currentNode)}". Exiting.`);
                break;
            }

            // Figure out next node
            const nextNode = this.pickNextNode(edgeList, state);
            logger.edge(currentNode, nextNode);

            // If no valid next node, we consider it the end
            currentNode = nextNode ?? "END";
        }

        // 2) Return the combined history and the final state
        return {
            history: combinedHistory,
            state,
        };
    }
}
