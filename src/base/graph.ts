import { Agent } from "./agent";
import { Logger } from "../helper/logger";
import { Mutex } from 'async-mutex'; // If using mutex for concurrency control

const logger = new Logger();

export class Graph {
    _type = "graph"
    name: string
    description: string
    private edges = new Map<TWorker | string, Edge[]>();
    private MAX_NODES = 1000;
    private MAX_EDGES_PER_NODE = 100;
    private invocationMutex = new Mutex(); // For concurrency control

    constructor(i: IGraph) {
        this.name = i.name;
        this.description = i.description;

        // // Validate that the graph has at least one node (e.g., "START")
        // if (!this.edges.has("START")) {
        //     throw new Error(`Graph "${this.name}" must have a "START" node with outgoing edges.`);
        // }

        // Optionally, validate that there is an "END" node or that some path leads to "END"
    }

    private validateNode(node: TWorker | string): void {
        if (node === undefined || node === null) {
            throw new Error(`Node cannot be undefined or null.`);
        }
        if (typeof node !== "string" && !(node instanceof Agent)) {
            throw new Error(`Invalid node type: ${typeof node}. Node must be a string or an Agent instance.`);
        }
    }

    private hasEdge(fromNode: TWorker | string, newEdge: Edge): boolean {
        const edges = this.getOrCreateEdges(fromNode);
        return edges.some(edge => {
            if (edge.type !== newEdge.type) return false;
            switch (edge.type) {
                case "direct":
                    return (edge as DirectEdge).to === (newEdge as DirectEdge).to;
                case "conditional":
                    return (edge as ConditionalEdge).fn === (newEdge as ConditionalEdge).fn;
                case "parallel":
                    return JSON.stringify((edge as ParallelEdge).to) === JSON.stringify((newEdge as ParallelEdge).to) &&
                           (edge as ParallelEdge).next === (newEdge as ParallelEdge).next;
            }
        });
    }

    public addEdge(from: TWorker | string, to: TWorker | string) {
        this.validateNode(from);
        this.validateNode(to);

        if (this.edges.size >= this.MAX_NODES && !this.edges.has(from)) {
            throw new Error(`Cannot add more nodes to the graph. Maximum of ${this.MAX_NODES} nodes reached.`);
        }

        const list = this.getOrCreateEdges(from);
        if (list.length >= this.MAX_EDGES_PER_NODE) {
            throw new Error(`Cannot add more edges to node "${String(from)}". Maximum of ${this.MAX_EDGES_PER_NODE} edges per node reached.`);
        }

        const newEdge: DirectEdge = { type: "direct", to };
        if (this.hasEdge(from, newEdge)) {
            throw new Error(`Duplicate direct edge from "${String(from)}" to "${String(to)}" is not allowed.`);
        }

        list.push(newEdge);
        return this;
    }

    public addConditionalEdge(from: TWorker | string, fn: (state: any) => TWorker | string) {
        this.validateNode(from);
        if (typeof fn !== "function") {
            throw new Error(`Invalid function provided for conditional edge from "${String(from)}".`);
        }

        const list = this.getOrCreateEdges(from);
        const newEdge: ConditionalEdge = { type: "conditional", fn };
        
        if (this.hasEdge(from, newEdge)) {
            throw new Error(`Duplicate conditional edge from "${String(from)}" is not allowed.`);
        }

        list.push(newEdge);
        return this;
    }

    public addParallelEdges(
        from: TWorker | string,
        targets: (TWorker | string)[],
        next?: TWorker | string
    ) {
        this.validateNode(from);
        if (!Array.isArray(targets) || targets.some(target => typeof target !== "string" && !(target instanceof Agent))) {
            throw new Error(`Invalid targets provided for parallel edges from "${String(from)}". Targets must be an array of strings or Agent instances.`);
        }
        if (next && typeof next !== "string" && !(next instanceof Agent)) {
            throw new Error(`Invalid next node provided for parallel edges from "${String(from)}". Next node must be a string or an Agent instance.`);
        }

        if (next && typeof next === "string" && next !== "END" && !this.nodeExists(next)) {
            console.warn(`Next node "${String(next)}" specified in parallel edge from "${String(from)}" does not exist yet.`);
            // Optionally, throw an error or allow dynamic node addition
        }

        const list = this.getOrCreateEdges(from);
        if (list.length >= this.MAX_EDGES_PER_NODE) {
            throw new Error(`Cannot add more edges to node "${String(from)}". Maximum of ${this.MAX_EDGES_PER_NODE} edges per node reached.`);
        }

        const newEdge: ParallelEdge = { type: "parallel", to: targets, next };
        if (this.hasEdge(from, newEdge)) {
            throw new Error(`Duplicate parallel edge from "${String(from)}" is not allowed.`);
        }

        list.push(newEdge);
        return this;
    }

    private getOrCreateEdges(fromNode: TWorker | string): Edge[] {
        if (!this.edges.has(fromNode)) {
            if (this.edges.size >= this.MAX_NODES) {
                throw new Error(`Cannot add more nodes to the graph. Maximum of ${this.MAX_NODES} nodes reached.`);
            }
            this.edges.set(fromNode, []);
        }
        return this.edges.get(fromNode)!;
    }

    private nodeExists(node: TWorker | string): boolean {
        if (typeof node === "string") {
            return this.edges.has(node) || node === "END";
        } else {
            // Assuming Agent instances are always valid nodes
            return true;
        }
    }

    private getNextNodeFromEdge(edge: Edge, state: any): TWorker | string | (TWorker | string)[] | null {
        switch (edge.type) {
            case "direct":
                return edge.to;
            case "conditional":
                const result = edge.fn(state);
                if (result === undefined || result === null) {
                    throw new Error(`Conditional edge function returned invalid node: ${result}`);
                }
                this.validateNode(result);
                return result;
            case "parallel":
                return edge.to;
            default:
                throw new Error(`Unknown edge type: "${(edge as any).type}".`);
        }
    }

    private pickNextNode(edges: Edge[], state: any): TWorker | string | (TWorker | string)[] | null {
        for (const edge of edges) {
            const next = this.getNextNodeFromEdge(edge, state);
            if (next != null) {
                return next; // could be a single node or an array
            }
        }
        return null;
    }

    private async runAgent(agent: Agent, state: any, task: string): Promise<{ state: any, history: IMessage[] }> {
        try {
            const result = await agent.invoke({ state, task });
            if (!result || typeof result !== "object" || !('state' in result) || !('history' in result)) {
                throw new Error(`Agent "${agent.name}" returned an invalid result. Expected an object with 'state' and 'history'.`);
            }
            if (result.state && typeof result.state !== 'object') {
                throw new Error(`Agent "${agent.name}" returned an invalid 'state'. Expected an object.`);
            }
            if (result.history && !Array.isArray(result.history)) {
                throw new Error(`Agent "${agent.name}" returned an invalid 'history'. Expected an array.`);
            }
            return { state: result.state, history: result.history };
        } catch (error) {
            throw new Error(`Error invoking Agent "${agent.name}": ${error}`);
        }
    }

    public async invoke({
        state,
        task,
        startNode = "START",
    }: {
        state: any;
        task: string;
        startNode?: TWorker | string;
    }): Promise<IResult> {
        // Ensure single invocation at a time
        return this.invocationMutex.runExclusive(async () => {
            const combinedHistory: IMessage[] = [];
            let currentNode: TWorker | string = startNode;
            const visitedNodes = new Set<TWorker | string>();
            const MAX_INVOCATIONS = 1000; // Prevent excessively long runs

            let invocationCount = 0;

            // Validate inputs
            if (state === undefined || state === null || typeof state !== 'object') {
                throw new Error(`Invalid state provided to Graph.invoke. State must be a non-null object.`);
            }
            if (!task || typeof task !== 'string') {
                throw new Error(`Invalid task provided to Graph.invoke. Task must be a non-empty string.`);
            }
            if (startNode === undefined || startNode === null) {
                throw new Error(`Invalid startNode provided to Graph.invoke. Start node cannot be undefined or null.`);
            }
            if (!this.nodeExists(startNode)) {
                throw new Error(`Start node "${String(startNode)}" does not exist in the graph.`);
            }

            while (true) {
                invocationCount++;
                if (invocationCount > MAX_INVOCATIONS) {
                    throw new Error(`Invocation count exceeded the maximum limit of ${MAX_INVOCATIONS}. Possible circular dependency detected.`);
                }

                // 1) Check for END
                if (currentNode === "END") {
                    console.log("Reached END");
                    break;
                }

                // Detect circular dependency
                if (visitedNodes.has(currentNode)) {
                    throw new Error(`Circular dependency detected at node "${String(currentNode)}".`);
                }
                visitedNodes.add(currentNode);

                // 2) If currentNode is an Agent (i.e., not a string), invoke it
                if (typeof currentNode !== "string") {
                    const agent = currentNode as Agent;
                    const { state: newState, history } = await this.runAgent(agent, state, task);
                    if (newState) {
                        state = newState;
                    }
                    if (history && history.length) {
                        combinedHistory.push(...history);
                    }
                }

                // 3) Find the edges from currentNode
                const edgeList = this.edges.get(currentNode) || [];
                if (edgeList.length === 0) {
                    console.log(`No edges found for node "${String(currentNode)}". Exiting.`);
                    break;
                }

                // 4) Pick the next node (could be string, Agent, or an array)
                let nextNode: TWorker | string | (TWorker | string)[] | null;
                try {
                    nextNode = this.pickNextNode(edgeList, state);
                } catch (error) {
                    throw new Error(`Error picking next node from "${String(currentNode)}": ${error}`);
                }

                // 5) Log the edge traversal
                try {
                    logger.edge(currentNode, nextNode);
                } catch (loggingError) {
                    console.warn(`Logging failed for edge from "${String(currentNode)}" to "${String(nextNode)}":`, loggingError);
                }

                // 6) If no valid next node, we consider it done
                if (!nextNode) {
                    currentNode = "END";
                    continue;
                }

                // 7) Validate the next node(s)
                if (Array.isArray(nextNode)) {
                    nextNode.forEach(node => {
                        if (!this.nodeExists(node)) {
                            throw new Error(`Next node "${String(node)}" does not exist in the graph.`);
                        }
                    });
                } else {
                    if (!this.nodeExists(nextNode)) {
                        throw new Error(`Next node "${String(nextNode)}" does not exist in the graph.`);
                    }
                }

                // 8) If nextNode is an array => parallel edge
                if (Array.isArray(nextNode)) {
                    const parallelEdge = edgeList.find(e => e.type === "parallel") as ParallelEdge | undefined;
                    if (!parallelEdge) {
                        currentNode = "END";
                        continue;
                    }

                    // 1) run them all in parallel
                    const results = await Promise.all(
                        nextNode.map(async (n) => {
                            if (typeof n !== "string") {
                                try {
                                    return await this.runAgent(n as Agent, state, task);
                                } catch (error) {
                                    throw new Error(`Error invoking Agent in parallel edge: ${error}`);
                                }
                            } else {
                                // Handle string nodes appropriately
                                // For this example, we skip string nodes
                                return null;
                            }
                        })
                    ).catch(error => {
                        throw new Error(`Parallel edge invocation failed: ${error}`);
                    });

                    // 2) merge states/histories
                    results.forEach((r) => {
                        if (r?.state) {
                            state = r.state; // Consider merging strategies
                        }
                        if (r?.history?.length) {
                            combinedHistory.push(...r.history);
                        }
                    });

                    // 3) Validate and set the postNode
                    const postNode = parallelEdge.next || "END";
                    if (postNode !== "END" && !this.nodeExists(postNode)) {
                        throw new Error(`Next node "${String(postNode)}" specified in parallel edge does not exist in the graph.`);
                    }

                    currentNode = postNode;
                    continue;
                }

                // 9) Otherwise, we have a single nextNode => continue
                currentNode = nextNode;
            }

            // 10) Return the combined history and final state
            return {
                history: combinedHistory,
                state,
            };
        });
    }
}
