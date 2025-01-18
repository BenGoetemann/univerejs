import { openaiCompletion } from "../provider/openai";
import { groqCompletion } from "../provider/groq";
import { Logger } from "../helper/logger"
import { ZodSchema } from "zod";

export class Agent {
    _type = "agent"

    lifecycle: ILifecycle;
    name: string;
    description: string;
    task: string;
    retries: number;
    model: EModels;
    outputType: EOutput;
    outputSchema?: ZodSchema;
    tools?: any[];
    type?: EAgentType;
    history: IMessage[];
    logger: Logger

    constructor(agentConfig: IAgent) {
        this.lifecycle = agentConfig.lifecycle;
        this.name = agentConfig.name;
        this.description = agentConfig.description;
        this.task = agentConfig.task;
        this.retries = agentConfig.retries;
        this.model = agentConfig.model;
        this.outputType = agentConfig.outputType;
        this.type = agentConfig.type;
        this.tools = agentConfig.tools;
        this.outputSchema = agentConfig.outputSchema;
        this.history = []
        this.logger = new Logger()
    }

    async invoke(i: IInvocation): Promise<IResult> {
        try {

            let task = this.handlePromptInjections(this.task, i.state)

            this.history.push({
                name: this.name,
                role: "user",
                content: `${task} 
                
                !PLEASE LOOK ALWAYS AT THE SYSTEM MESSAGES FOR EVALUATION RESULTS TO IMPROVE YOUR OUTPUT!
                
                This is the user task:

                ${i.task}
                `

            });

            let result;
            for (let retry = 0; retry < this.retries; retry++) {

                result = await this.completion({
                    task: task,
                    history: this.history
                });

                this.history.push(result);

                const evaluations = await this.handleResultEvaluations(result);

                const output: ICompletionResult = {
                    final: evaluations.pass,
                    result
                };
                this.logger.result(this.name, output);

                if (output.final) {
                    break;
                }

                // Introduce error condition
                if (retry === this.retries - 1 && !output.final) {
                    throw new Error(`Agent "${this.name}" failed to produce a final output after ${this.retries} retries.`);
                }
            }

            this.handleStateManipulations(result, i.state, "afterRun")

            return {
                history: this.history,
                state: i.state
            };
        } catch (error) {
            console.error("Error invoking completion:", error);
            throw error;
        }
    }

    private async completion(i: ICompletionInput): Promise<any | null> {
        const { provider, model } = this.extractProviderAndModel();

        const providerMap: Record<string, (args: ICompletionConfig) => Promise<any>> = {
            openai: openaiCompletion,
            groq: groqCompletion,
        };

        const completionFn = providerMap[provider];
        if (!completionFn) {
            throw new Error(`Unsupported provider: "${provider}". Please check your configuration.`);
        }

        return await completionFn({
            model,
            task: i.task,
            history: i.history,
            name: this.name,
            outputType: this.outputType,
            outputSchema: this.outputSchema,
            tools: this.tools,
            lifecycle: this.lifecycle
        });
    }


    private extractProviderAndModel(): IProviderModelSplit {
        const regex = /^(.*?)\//;
        const match = this.model.match(regex);
        if (!match || !match[1]) {
            throw new Error(`Invalid provider/model format: "${this.model}". Expected format "provider/model".`);
        }

        const split = this.model.split("/");
        const provider = split[0];
        const model = split[1];

        const supportedProviders = ["openai", "groq"];
        if (!supportedProviders.includes(provider)) {
            throw new Error(`Unsupported provider: "${provider}". Supported providers are: ${supportedProviders.join(", ")}.`);
        }

        return { provider, model };
    }


    private async runResultEvaluations(
        conditions: Array<{ run: (state: any) => Promise<IActionResult> }>,
        state: any
    ): Promise<IActionResult> {
        const conditionResults = await Promise.all(
            conditions.map((condition) => condition.run(state))
        );

        const hasPassedAll = conditionResults.every((result) => result.pass);
        const failedReasons = conditionResults
            .filter((result) => !result.pass)
            .map((result, index) => `${index + 1}) ${result.reason.replace("Evaluation unsuccessful: ", "")}`)
            .join(" ");

        return {
            pass: hasPassedAll,
            reason: hasPassedAll
                ? "Evaluation successful"
                : `Evaluation unsuccessful. Reasons: ${failedReasons}`,
        };
    }

    private async handleResultEvaluations(result: any): Promise<{ pass: boolean }> {
        if (!this.lifecycle?.afterRun?.resultEvaluations) {
            return { pass: true }; // No evaluation needed
        }

        try {
            const parsedContent = JSON.parse(result.content);
            const evaluations = await this.runResultEvaluations(this.lifecycle.afterRun.resultEvaluations, parsedContent);

            this.history.push({
                name: "evaluator",
                role: "system",
                content: JSON.stringify(evaluations)
            });

            return evaluations || { pass: true }; // Default to true if evaluations are missing "pass"
        } catch (error) {
            console.warn("Evaluation failed due to invalid JSON:", error);
            this.history.push({
                name: "evaluator",
                role: "system",
                content: JSON.stringify({ pass: false, error: "Invalid JSON in result.content" })
            });
            throw new Error(`Evaluation failed: ${error}`);
        }
    }

    private handlePromptInjections(task: string, state: any): string {
        if (
            this.lifecycle &&
            this.lifecycle.beforeRun &&
            Array.isArray(this.lifecycle.beforeRun.promptInjections) &&
            this.lifecycle.beforeRun.promptInjections.length > 0
        ) {
            try {
                // Initialize an array to hold all reasons from prompt injections
                const reasons: string[] = [];
    
                // Iterate over each prompt injection and collect their reasons
                for (const injection of this.lifecycle.beforeRun.promptInjections) {
                    const injectionResult = injection.run(state);
                    
                    if (!injectionResult || !injectionResult.reason) {
                        throw new Error("Invalid prompt injection result.");
                    }
    
                    reasons.push(injectionResult.reason);
                }
    
                // Combine all reasons into a single string separated by spaces (or any delimiter you prefer)
                const combinedReasons = reasons.join(' ');
    
                // Append the combined reasons to the original task
                return `${task} ${combinedReasons}`;
            } catch (error) {
                throw new Error(`Prompt injection failed: ${error}`);
            }
        } else {
            return task;
        }
    }
    

    private handleStateManipulations(result: any, state: any, stage: "afterRun" | "beforeRun"): void {
        const manipulations = this.lifecycle[stage]?.stateManipulations;
        if (manipulations) {
            manipulations.forEach((func) => {
                try {
                    func.run(result, state);
                } catch (error) {
                    throw new Error(`State manipulation failed during "${stage}": ${error}`);
                }
            });
        }
    }

}

