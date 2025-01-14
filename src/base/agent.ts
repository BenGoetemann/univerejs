import { openaiCompletion } from "../provider/openai";
import { groqCompletion } from "../provider/groq";
import { Logger } from "../helper/logger"

export class Agent {
    _type = "agent"

    lifecycle: ILifecycle;
    name: string;
    task: string;
    retries: number;
    model: EModels;
    outputType: EOutput;
    outputSchema?: TObject;
    tools: any[];
    type: EAgentType;
    history: IMessage[];
    logger: Logger

    constructor(agentConfig: IAgent) {
        this.lifecycle = agentConfig.lifecycle;
        this.name = agentConfig.name;
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

            const task = this.handlePromptInjections(this.task, i.state) 

            this.history.push({
                name: this.name,
                role: "user",
                content: `${task} - Please look always at the system messages for evaluation results to improve your output.`
            });

            let result;
            for (let j = 0; j < this.retries; j++) {

                result = await this.completion({
                    task: task,
                    history: this.history
                });

                this.history.push(result);

                const evaluations = await this.handleEvaluation(result);

                const output: ICompletionResult = {
                    final: evaluations.pass,
                    result
                };
                this.logger.result(this.name, output);

                if (output.final) {
                    break;
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
            throw new Error(`Unsupported provider: ${provider}`);
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
            throw new Error(`Invalid provider: ${this.model}`);
        }

        const split = this.model.split("/");

        return {
            provider: split[0],
            model: split[1],
        };
    }

    private async runEvaluations(
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

    private async handleEvaluation(result: any): Promise<{ pass: boolean }> {
        if (!this.lifecycle?.afterRun?.evaluations) {
            return { pass: true }; // No evaluation needed
        }

        try {
            const parsedContent = JSON.parse(result.content);
            const evaluations = await this.runEvaluations(this.lifecycle.afterRun?.evaluations, parsedContent);

            this.history.push({
                name: "evaluator",
                role: "system",
                content: JSON.stringify(evaluations)
            });

            return evaluations || { pass: true }; // Default to true if evaluations are missing "pass"
        } catch (error) {
            console.warn("Evaluation failed:", error);
            this.history.push({
                name: "evaluator",
                role: "system",
                content: JSON.stringify({ pass: false, error: error as any })
            });
            return { pass: false }; // Fail-safe on error
        }
    }

    private handlePromptInjections(task: string, state: any): string {
        if (this.lifecycle?.beforeRun?.promptInjections?.length > 0) {
            return task + " " + this.lifecycle.beforeRun.promptInjections[0].run(state).reason
        } else {
            return task
        }
    }

    private handleStateManipulations(result: any, state: any, stage: "afterRun" | "beforeRun"): void {
        this.lifecycle[stage]?.stateManipulations?.forEach((func) => {
            func.run(result!, state);
        });
    }
}

