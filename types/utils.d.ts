declare global {
  type TObject = Record<string, unknown>;
  type TId = string | number
  type TFunction = (input?: any) => any
  interface ILogger {
    log: (message: string) => string
  }

  interface IProviderModelSplit {
    provider: string;
    model: string;
}
}

export { }; // This ensures it is treated as a module