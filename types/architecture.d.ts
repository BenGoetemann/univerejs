declare global {
  interface IArchitecture extends IAgent {
    _type?: string
    retries: number
  }

  interface ISupervisor extends IArchitecture {
    supervisor: IAgent
    agents: IArchitecture[]
  }

  interface IPipe extends IArchitecture {
    pipe: IArchitecture[]
  }
}

export { }; // This ensures it is treated as a module