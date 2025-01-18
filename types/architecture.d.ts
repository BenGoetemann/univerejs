import { Agent, Graph, Pipe, Team, Vote } from "../src"

declare global {
  interface IArchitecture {
    _type?: string
    name: string,
    description: string
  }

  interface ISupervisor extends IArchitecture {
    model: EModels
    worker: TArchitecturesClasses[]
  }

  interface ITeam extends IArchitecture {
    supervisor: Agent
    worker: TArchitecturesClasses[]
  }

  interface IPipe extends IArchitecture {
    worker: TArchitecturesClasses[]
  }

  interface IGraph extends IArchitecture { }

  interface IVote extends IArchitecture {
    worker: TArchitecturesClasses[]
    synthesizer: Agent
  }

  type TWorker = Agent | Team | Pipe | Graph | Vote
}

export { }; // This ensures it is treated as a module