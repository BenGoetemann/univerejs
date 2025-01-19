import { Agent } from "./agent";
import { Logger } from "../helper/logger";
import { Mutex } from 'async-mutex'; // If using mutex for concurrency control
import { ConditionalEdge, DirectEdge, Edge, IGraph, IGraphInvocation, IMessage, IResult, ParallelEdge, TWorker } from "../types";

const logger = new Logger();

export class Graph {
    // Graph metadata
    _type = "graph";
    name: string;
    description: string;

    // Graph structure
    private edges = new Map<TWorker | string, Edge[]>();
    private readonly MAX_NODES = 1000;
    private readonly MAX_EDGES_PER_NODE = 100;

    // Concurrency control
    private invocationMutex = new Mutex();

    /**
     * Constructs a new Graph instance with the provided configuration.
     *
     * @param {IGraph} config - The configuration object for the graph.
     * @param {string} config.name - The name of the graph.
     * @param {string} config.description - The description of the graph.
     */
    constructor(config: IGraph) {
        this.name = config.name;
        this.description = config.description;

        // this.validateStartNode();
    }

    // === Node and Edge Validation ===

    private validateStartNode(): void {
        if (!this.edges.has("START")) {
            throw new Error(`Graph "${this.name}" must have a "START" node with outgoing edges.`);
        }
        // Optionally, add validation for "END" node or paths leading to "END"
    }

    private validateNode(node: TWorker | string): void {
        if (node === undefined || node === null) {
            throw new Error(`Node cannot be undefined or null.`);
        }
    }

    private nodeExists(node: TWorker | string): boolean {
        if (typeof node === "string") {
            return this.edges.has(node) || node === "END";
        }
        // Assuming Agent instances are always valid nodes
        return true;
    }

    // === Edge Management ===

    private getOrCreateEdges(fromNode: TWorker | string): Edge[] {
        if (!this.edges.has(fromNode)) {
            this.ensureMaxNodes();
            this.edges.set(fromNode, []);
        }
        return this.edges.get(fromNode)!;
    }

    private ensureMaxNodes(): void {
        if (this.edges.size >= this.MAX_NODES) {
            throw new Error(`Cannot add more nodes to the graph. Maximum of ${this.MAX_NODES} nodes reached.`);
        }
    }

    private ensureMaxEdges(fromNode: TWorker | string): void {
        const edges = this.getOrCreateEdges(fromNode);
        if (edges.length >= this.MAX_EDGES_PER_NODE) {
            throw new Error(`Cannot add more edges to node "${String(fromNode)}". Maximum of ${this.MAX_EDGES_PER_NODE} edges per node reached.`);
        }
    }

    private hasEdge(fromNode: TWorker | string, newEdge: Edge): boolean {
        const edges = this.getOrCreateEdges(fromNode);
        return edges.some(edge => this.areEdgesEqual(edge, newEdge));
    }

    private areEdgesEqual(edge1: Edge, edge2: Edge): boolean {
        if (edge1.type !== edge2.type) return false;

        switch (edge1.type) {
            case "direct":
                return (edge1 as DirectEdge).to === (edge2 as DirectEdge).to;
            case "conditional":
                return (edge1 as ConditionalEdge).fn === (edge2 as ConditionalEdge).fn;
            case "parallel":
                const e1 = edge1 as ParallelEdge;
                const e2 = edge2 as ParallelEdge;
                return JSON.stringify(e1.to) === JSON.stringify(e2.to) && e1.next === e2.next;
            default:
                return false;
        }
    }

    /**
     * Adds a direct edge from one node to another in the graph.
     *
     * @param {TWorker | string} from - The starting node of the edge.
     * @param {TWorker | string} to - The ending node of the edge.
     * @returns {this} The current instance of the graph.
     * @throws {Error} If a duplicate edge is detected or if the maximum number of nodes or edges is exceeded.
     */
    public addEdge(from: TWorker | string, to: TWorker | string): this {
        this.validateNode(from);
        this.validateNode(to);
        this.ensureMaxNodes();
        this.ensureMaxEdges(from);

        const newEdge: DirectEdge = { type: "direct", to };
        if (this.hasEdge(from, newEdge)) {
            throw new Error(`Duplicate direct edge from "${String(from)}" to "${String(to)}" is not allowed.`);
        }

        this.getOrCreateEdges(from).push(newEdge);
        return this;
    }

    /**
     * Adds a conditional edge from one node to another in the graph.
     *
     * @param {TWorker | string} from - The starting node of the edge.
     * @param {(state: any) => TWorker | string} fn - The function that determines the target node based on the state.
     * @returns {this} The current instance of the graph.
     * @throws {Error} If a duplicate edge is detected.
     */
    public addConditionalEdge(from: TWorker | string, fn: (state: any) => TWorker | string): this {
        this.validateNode(from);
        this.validateFunction(fn, `conditional edge from "${String(from)}"`);

        const newEdge: ConditionalEdge = { type: "conditional", fn };
        if (this.hasEdge(from, newEdge)) {
            throw new Error(`Duplicate conditional edge from "${String(from)}" is not allowed.`);
        }

        this.getOrCreateEdges(from).push(newEdge);
        return this;
    }

    /**
     * Adds parallel edges from one node to multiple target nodes in the graph.
     *
     * @param {TWorker | string} from - The starting node of the edge.
     * @param {(TWorker | string)[]} targets - The target nodes of the parallel edge.
     * @param {TWorker | string} [next] - The next node to transition to after the parallel edges.
     * @returns {this} The current instance of the graph.
     * @throws {Error} If a duplicate edge is detected or if the maximum number of edges is exceeded.
     */
    public addParallelEdges(
        from: TWorker | string,
        targets: (TWorker | string)[],
        next?: TWorker | string
    ): this {
        this.validateNode(from);
        this.validateParallelTargets(targets, from);
        this.validateNextNode(next, from);

        this.ensureMaxEdges(from);

        const newEdge: ParallelEdge = { type: "parallel", to: targets, next };
        if (this.hasEdge(from, newEdge)) {
            throw new Error(`Duplicate parallel edge from "${String(from)}" is not allowed.`);
        }

        this.getOrCreateEdges(from).push(newEdge);
        return this;
    }

    private validateFunction(fn: any, context: string): void {
        if (typeof fn !== "function") {
            throw new Error(`Invalid function provided for ${context}.`);
        }
    }

    private validateParallelTargets(targets: any[], from: TWorker | string): void {
        if (!Array.isArray(targets) || targets.some(target => typeof target !== "string" && !(target instanceof Agent))) {
            throw new Error(`Invalid targets provided for parallel edges from "${String(from)}". Targets must be an array of strings or Agent instances.`);
        }
    }

    private validateNextNode(next: any, from: TWorker | string): void {
        if (next && typeof next !== "string" && !(next instanceof Agent)) {
            throw new Error(`Invalid next node provided for parallel edges from "${String(from)}". Next node must be a string or an Agent instance.`);
        }

        if (next && typeof next === "string" && next !== "END" && !this.nodeExists(next)) {
            console.warn(`Next node "${String(next)}" specified in parallel edge from "${String(from)}" does not exist yet.`);
        }
    }

    // === Node Existence Check ===

    // Already handled in nodeExists method

    // === Edge Retrieval ===

    private getNextNodeFromEdge(edge: Edge, state: any): TWorker | string | (TWorker | string)[] | null {
        switch (edge.type) {
            case "direct":
                return edge.to;
            case "conditional":
                const result = edge.fn(state);
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
                return next;
            }
        }
        return null;
    }

    // === Agent Invocation ===

    private async runAgent(agent: Agent, state: any, task: string): Promise<{ state: any, history: IMessage[] }> {
        try {
            const result = await agent.invoke({ state, task });
            this.validateAgentResult(agent, result);
            return { state: result.state, history: result.history };
        } catch (error) {
            throw new Error(`Error invoking Agent "${agent.name}": ${error}`);
        }
    }

    private validateAgentResult(agent: Agent, result: any): void {
        if (!result || typeof result !== "object") {
            throw new Error(`Agent "${agent.name}" returned an invalid result. Expected an object with 'state' and 'history'.`);
        }
        if ('state' in result && typeof result.state !== 'object') {
            throw new Error(`Agent "${agent.name}" returned an invalid 'state'. Expected an object.`);
        }
        if ('history' in result && !Array.isArray(result.history)) {
            throw new Error(`Agent "${agent.name}" returned an invalid 'history'. Expected an array.`);
        }
    }

    // === Invocation Method ===

    /**
     * Invokes the graph starting from the specified node or "START" by default.
     * It traverses the graph, invoking agents and transitioning between nodes based on the edges.
     * The traversal continues until the "END" node is reached or no more edges are available.
     *
     * @param {IGraphInvocation} i - The invocation object containing the state, task, and optional start node.
     * @returns {Promise<IResult>} - A promise that resolves to the result of the graph invocation, including the final state and combined history.
     * @throws {Error} - Throws an error if the invocation inputs are invalid, if an agent invocation fails, or if there is an error picking the next node.
     */
    public async invoke(i: IGraphInvocation): Promise<IResult> {
        return this.invocationMutex.runExclusive(async () => {

            const startNode = i.startNode ?? "START"

            this.validateInvocationInputs(i.state, i.task, startNode);

            const combinedHistory: IMessage[] = [];
            let currentNode: TWorker | string = startNode;
            const visitedNodes = new Set<TWorker | string>();
            const MAX_INVOCATIONS = 1000;
            let invocationCount = 0;

            while (true) {
                invocationCount++;
                this.ensureMaxInvocations(invocationCount, MAX_INVOCATIONS);

                if (currentNode === "END") {
                    console.log("Reached END");
                    break;
                }

                visitedNodes.add(currentNode);

                if (typeof currentNode !== "string") {
                    const agent = currentNode as Agent;
                    const { state: newState, history } = await this.runAgent(agent, i.state, i.task);
                    i.state = newState || i.state;
                    if (history?.length) {
                        combinedHistory.push(...history);
                    }
                }

                const edgeList = this.edges.get(currentNode) || [];
                if (edgeList.length === 0) {
                    console.log(`No edges found for node "${String(currentNode)}". Exiting.`);
                    break;
                }

                let nextNode: TWorker | string | (TWorker | string)[] | null;
                try {
                    nextNode = this.pickNextNode(edgeList, i.state);
                } catch (error) {
                    throw new Error(`Error picking next node from "${String(currentNode)}": ${error}`);
                }

                this.logEdgeTraversal(currentNode, nextNode);

                if (!nextNode) {
                    currentNode = "END";
                    continue;
                }

                this.validateNextNodePresence(nextNode);

                if (Array.isArray(nextNode)) {
                    currentNode = await this.handleParallelEdges(nextNode, edgeList, i.state, i.task);
                    continue;
                }

                currentNode = nextNode;
            }

            return { history: combinedHistory, state: i.state };
        });
    }

    private validateInvocationInputs(state: any, task: string, startNode: any): void {
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
    }

    private ensureMaxInvocations(count: number, max: number): void {
        if (count > max) {
            throw new Error(`Invocation count exceeded the maximum limit of ${max}. Possible circular dependency detected.`);
        }
    }

    private logEdgeTraversal(from: TWorker | string, to: any): void {
        try {
            logger.edge(from, to);
        } catch (loggingError) {
            console.warn(`Logging failed for edge from "${String(from)}" to "${String(to)}":`, loggingError);
        }
    }

    private validateNextNodePresence(nextNode: any): void {
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
    }

    private async handleParallelEdges(
        nextNodes: (TWorker | string)[],
        edgeList: Edge[],
        state: any,
        task: string
    ): Promise<TWorker | string> {
        const parallelEdge = edgeList.find(e => e.type === "parallel") as ParallelEdge | undefined;
        if (!parallelEdge) {
            return "END";
        }

        const results = await this.invokeParallelAgents(nextNodes, state, task);

        results.forEach(result => {
            if (result?.state) {
                state = result.state; // Consider implementing a merge strategy if needed
            }
            if (result?.history?.length) {
                // Assuming combinedHistory is accessible here or handle differently
                // combinedHistory.push(...result.history);
            }
        });

        const postNode = parallelEdge.next || "END";
        if (postNode !== "END" && !this.nodeExists(postNode)) {
            throw new Error(`Next node "${String(postNode)}" specified in parallel edge does not exist in the graph.`);
        }

        return postNode;
    }

    private async invokeParallelAgents(
        targets: (TWorker | string)[],
        state: any,
        task: string
    ): Promise<Array<{ state: any, history: IMessage[] } | null>> {
        return Promise.all(
            targets.map(async (target) => {
                if (typeof target !== "string") {
                    const agent = target as Agent;
                    return await this.runAgent(agent, state, task);
                }
                // Handle string nodes if necessary
                return null;
            })
        ).catch(error => {
            throw new Error(`Parallel edge invocation failed: ${error}`);
        });
    }
}
