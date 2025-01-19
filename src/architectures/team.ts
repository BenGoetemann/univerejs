import { Agent } from "../base/agent";
import { Graph } from "../base/graph";
import { IInvocation, IResult, ITeam, TWorker } from "../types";

export class Team {
    _type = "team";
    name: string;
    description: string;
    supervisor: Agent;
    workers: TWorker[];

    /**
     * Constructs a new Team instance with the provided configuration.
     *
     * @param {ITeam} config - The configuration object for the team.
     * @param {Agent} config.supervisor - The supervisor agent for the team.
     * @param {TWorker[]} config.workers - The list of workers in the team.
     * @param {string} config.name - The name of the team.
     * @param {string} config.description - The description of the team.
     */
    constructor(config: ITeam) {
        this.supervisor = config.supervisor;
        this.workers = config.workers;
        this.name = config.name;
        this.description = config.description;
    }

    /**
     * Invokes the team by creating and executing a graph.
     * The graph starts with the supervisor and conditionally routes to child agents based on the state.
     * 
     * @param {IInvocation} i - The invocation object containing the state and task.
     * @returns {Promise<IResult>} - A promise that resolves to the result of the graph invocation, including the final state and combined history.
     */
    async invoke(i: IInvocation): Promise<IResult> {
        // 1) Create a new Graph
        const graph = new Graph({
            name: "team_graph",
            description: "the graph of a team"
        });

        // 2) Add an edge from START to the supervisor
        graph.addEdge("START", this.supervisor);

        // 3) Add a conditional edge from the supervisor to whichever child agent
        //    (or "END") is appropriate. For instance, you might look up
        //    state.state.next and see if it matches any of the childAgents.
        graph.addConditionalEdge(this.supervisor, (context) => {
            // You can decide how you want to map `context.state.next` to an agent.
            // e.g. if each agent has a name/id property:

            if (context.state.router.done) {
                return "END";
            }

            const nextKey = context.state.router.next;
            const foundAgent = this.workers.find(
                (worker) => (worker as TWorker).name === nextKey // or agent.name === nextKey
            );
            return foundAgent ?? "END";
        });

        // 4) For each child agent, add an edge back to the supervisor
        this.workers.forEach((worker) => {
            graph.addEdge(worker, this.supervisor);
        });

        // 5) Finally, invoke the graph from START
        const result = await graph.invoke({
            state: i.state,
            task: i.task,
            startNode: "START",
        });

        // 6) Return combined history + updated state
        return {
            history: result.history,
            state: result.state,
        };
    }
}
