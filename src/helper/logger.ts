import { bgBlack, bgBlue, underline } from "colorette"
import { Agent } from "../base/agent";
import { Pipe } from "../architectures";

export class Logger {
    result = (name: string, result: ICompletionResult) => {
        console.log(bgBlack(`🤖 AGENT [${name}]: `))
        const parsedResult = {
            ...result,
            result: {
                ...result.result,
                content: JSON.parse(result.result.content)
            }
        };
        console.dir(parsedResult, { depth: null });
        console.log("------------------")
    }
    resultEvaluation = (field: string, evaluation: IActionResult) => {
        console.log(bgBlack(`🤔 AGENT RESULT EVALUATOR [${field}]`))
        console.dir(evaluation, { depth: null })
        console.log("------------------")
    }

    stateManipulation = (keyPath: string, evaluation: IActionResult) => {
        console.log(bgBlack(`📝 STATE MANIPULATOR [${keyPath}]`))
        console.dir(evaluation, { depth: null })
        console.log("------------------")
    }

    tool = (name: string) => {
        console.log(bgBlack(`🛠️ TOOL USE [${name}]`))
        console.log("------------------")
    }

    promptInjection = (field: string, evaluation: IActionResult) => {
        console.log(bgBlack(`💉 PROMPT INJECTION [${field}]`))
        console.dir(evaluation, { depth: null })
        console.log("------------------")
    }

    edge = (currentNode: TWorker | string, nextNode: TWorker | string | null) => {
        const currentNodeName = typeof currentNode === "string" ? currentNode : currentNode.name;
        const nextNodeName = typeof nextNode === "string" ? nextNode : nextNode?.name || "END";
        console.log(bgBlue(`⛓️‍💥 ${currentNodeName} => ${nextNodeName}`))
        console.log("------------------")
    }
}