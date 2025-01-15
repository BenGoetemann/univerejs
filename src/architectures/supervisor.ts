import { Agent } from "../base/agent";
import { Graph } from "../base/graph";

interface ISupervisorConfig {
    supervisor: Agent;       // The "hub" agent
    agents: Agent[];         // Any number of agents that reconnect to supervisor
}

export class Supervisor {
    _type = "supervisor";
    supervisorAgent: Agent;
    childAgents: Agent[];

    constructor(config: ISupervisorConfig) {
        this.supervisorAgent = config.supervisor;
        this.childAgents = config.agents;
    }

    async invoke(i: IInvocation): Promise<IResult> {
        // 1) Create a new Graph
        const graph = new Graph();

        // 2) Add an edge from START to the supervisor
        graph.addEdge("START", this.supervisorAgent);

        // 3) Add a conditional edge from the supervisor to whichever child agent
        //    (or "END") is appropriate. For instance, you might look up
        //    state.state.next and see if it matches any of the childAgents.
        graph.addConditionalEdge(this.supervisorAgent, (context) => {
            // You can decide how you want to map `context.state.next` to an agent.
            // e.g. if each agent has a name/id property:

            if (context.state.router.done) {
                return "END";
            }

            const nextKey = context.state.router.next;
            const foundAgent = this.childAgents.find(
                (agent) => (agent as any).name === nextKey // or agent.name === nextKey
            );
            return foundAgent ?? "END";
        });

        // 4) For each child agent, add an edge back to the supervisor
        this.childAgents.forEach((agent) => {
            graph.addEdge(agent, this.supervisorAgent);
        });

        // 5) Finally, invoke the graph from START
        const result = await graph.invoke({
            state: i.state,
            startNode: "START",
        });

        // 6) Return combined history + updated state
        return {
            history: result.history,
            state: result.state,
        };
    }
}
