import { Agent } from "./agent";
import { Logger } from "../helper/logger";
import { Pipe } from "../architectures";

const logger = new Logger();

export class Graph {
    /**
     * We'll store edges in a Map:
     *   key: a node (string | Agent)
     *   value: an array of Edge descriptors
     */
    _type = "graph"
    name: string
    description: string
    private edges = new Map<TWorker | string, Edge[]>();

    constructor(i: IGraph) {
        this.name = i.name
        this.description = i.description
    }

    /**
     * Helper to safely retrieve or create the edge list for `fromNode`.
     */
    private getOrCreateEdges(fromNode: TWorker | string): Edge[] {
        if (!this.edges.has(fromNode)) {
            this.edges.set(fromNode, []);
        }
        return this.edges.get(fromNode)!;
    }

    /**
     * Add a direct edge: always go from `from` to `to`.
     */
    public addEdge(from: TWorker | string, to: TWorker | string) {
        const list = this.getOrCreateEdges(from);
        list.push({ type: "direct", to });
        return this; // allow chaining
    }

    /**
     * Add a conditional edge: calls `fn(state)` to decide the next node.
     */
    public addConditionalEdge(from: TWorker | string, fn: (state: any) => TWorker | string) {
        const list = this.getOrCreateEdges(from);
        list.push({ type: "conditional", fn });
        return this;
    }

    public addParallelEdges(
        from: TWorker | string,
        targets: (TWorker | string)[],
        next?: TWorker | string
    ) {
        const list = this.getOrCreateEdges(from);
        list.push({ type: "parallel", to: targets, next });
        return this;
    }



    /**
     * Internal helper to pick the "next" node for a given edge,
     * given the current `state`.
     */
    private getNextNodeFromEdge(edge: Edge, state: any): TWorker | string | (TWorker | string)[] | null {
        switch (edge.type) {
            case "direct":
                return edge.to;
            case "conditional":
                return edge.fn(state);
            case "parallel":
                // Return the array of targets
                return edge.to;
        }
    }
    /**
     * Another helper to pick the FIRST valid next node
     * from all the edge descriptors attached to the current node.
     */
    private pickNextNode(edges: Edge[], state: any): TWorker | string | (TWorker | string)[] | null {
        for (const edge of edges) {
            const next = this.getNextNodeFromEdge(edge, state);
            if (next != null) {
                return next; // could be a single node or an array
            }
        }
        return null;
    }


    /**
     * Invoke the graph by starting from `startNode` (default = "START").
     * We'll loop until we reach "END" or have nowhere else to go.
     * We'll also accumulate the "combined history" from each Agent invocation.
     */
    public async invoke({
        state,
        task,
        startNode = "START",
    }: {
        state: any;
        task: string;
        startNode?: TWorker | string;
    }): Promise<IResult> {
        const combinedHistory: IMessage[] = [];
        let currentNode: TWorker | string = startNode;

        while (true) {
            // 1) Check for END
            if (currentNode === "END") {
                console.log("Reached END");
                break;
            }

            // 2) If currentNode is an Agent (i.e., not a string), invoke it
            if (typeof currentNode !== "string") {
                const result = await currentNode.invoke({ state, task });

                if (result?.state) {
                    state = result.state;
                }
                if (result?.history?.length) {
                    combinedHistory.push(...result.history);
                }
            }

            // 3) Find the edges from currentNode
            const edgeList = this.edges.get(currentNode) || [];
            if (edgeList.length === 0) {
                console.log(`No edges found for node "${String(currentNode)}". Exiting.`);
                break;
            }

            // 4) Pick the next node (could be string, Agent, or an array)
            const nextNode = this.pickNextNode(edgeList, state);
            logger.edge(currentNode, nextNode);

            // 5) If no valid next node, we consider it done
            if (!nextNode) {
                currentNode = "END";
                continue;
            }

            // 6) If nextNode is an array => parallel edge
            if (Array.isArray(nextNode)) {
                // We'll get here if pickNextNode(...) returned the array
                // So we need to find the actual edge that triggered it:
                const parallelEdge = edgeList.find(e => e.type === "parallel");
                if (!parallelEdge || parallelEdge.type !== "parallel") {
                    // fallback if somehow no parallel edge found
                    currentNode = "END";
                    continue;
                }

                // 1) run them all in parallel
                const results = await Promise.all(
                    nextNode.map(async (n) => {
                        if (typeof n !== "string") {
                            return await n.invoke({ state, task });
                        } else {
                            // If it's a string, you might do something else,
                            // or skip, or recursively invoke the graph
                            return null;
                        }
                    })
                );

                // 2) merge states/histories
                results.forEach((r) => {
                    if (r?.state) {
                        state = r.state; // TODO: Observe
                    }
                    if (r?.history?.length) {
                        combinedHistory.push(...r.history);
                    }
                });

                // 3) If the parallel edge has a `next`, route there
                //    else, default to END
                const postNode = parallelEdge.next || "END";
                currentNode = postNode;
                continue;
            }


            // 7) Otherwise, we have a single nextNode => continue
            currentNode = nextNode;
        }

        // 8) Return the combined history and final state
        return {
            history: combinedHistory,
            state,
        };
    }

}
