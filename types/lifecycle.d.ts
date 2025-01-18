declare global {
    interface IAction {
        state: TState
        run: (...params: any) => boolean
    }

    interface IStateManipulation extends IAction {
        from: string,
        to: string,
    }

    interface IPromptInjections extends IAction {
        prompt: string
    }

    interface IEvaluation extends IAction {
        is: boolean
    }

    interface ILifecycle {
        beforeRun?: {
            stateManipulations?: any[],
            promptInjections?: any[]
        },
        afterRun: {
            stateManipulations: any[],
            resultEvaluations?: any[]
            stateEvaluations?: any[]
            stopConditions?: any[]
        }
    }
}

export { }; // This ensures it is treated as a module