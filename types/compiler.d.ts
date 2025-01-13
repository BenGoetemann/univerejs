declare global {
  interface IStore {
    url: string
    password: string
  }

  interface IState {
    schema: TObject
  }

  interface ICompiler {
    base: IArchitecture
    state: IState
    store: IStore
    verbose: boolean
    thread: TId
  }
}

export { }; // This ensures it is treated as a module