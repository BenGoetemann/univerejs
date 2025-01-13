declare global {
    interface IBaseTool {
        name: string
        description: string
    }

    interface IRest extends IBaseTool {
        url: string,
        headers?: TObject
    }

    interface IGet extends IRest { }

    interface IPost extends IRest {
        body: TObject
    }

    interface ITool extends IBaseTool {
        function: TFunction
    }
}

export { }; // This ensures it is treated as a module