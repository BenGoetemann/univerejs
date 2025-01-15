declare global {
  interface IStore {
    url: string
    password: string
  }

  interface ICompiler {
    base: IArchitecture
    state: TState
    store: IStore
    verbose: boolean
    thread: TId
  }
}

export { }; // This ensures it is treated as a module