import OpenAI from "openai";
import 'dotenv/config';  // Loads environment variables from .env
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { Logger } from "../helper/logger";

const openai = new OpenAI();
const logger = new Logger()

export async function openaiCompletion(completionConfig: ICompletionConfig): Promise<IMessage | undefined> {
  try {

    const completionTypeMap: Record<EOutput, (config: ICompletionConfig) => Promise<IMessage>> = {
      'json': structuredCompletion,
      'text': textCompletion,
      'tool_call': toolCompletion,
    };

    const completionType = completionTypeMap[completionConfig.outputType];
    if (!completionType) {
      throw new Error(`Unsupported output type: ${completionConfig.outputType}`);
    }

    const result = await completionType(completionConfig);

    return result
  } catch (error) {
    console.error("Error:", error);
  }
}

export const structuredCompletion = async (completionConfig: ICompletionConfig): Promise<IMessage> => {
  const completion = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "system",
        content: completionConfig.task,
      },
      ...completionConfig.history
    ],
    model: completionConfig.model,
    stream: false,
    tools: completionConfig.tools,
    response_format: zodResponseFormat(completionConfig.outputSchema, "result"),
  });

  return {
    name: completionConfig.name,
    role: "assistant",
    content: JSON.stringify(completion.choices[0].message.parsed)
  }
}

export const textCompletion = async (completionConfig: ICompletionConfig): Promise<IMessage> => {
  const completion = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "system",
        content: completionConfig.task,
      },
      ...completionConfig.history
    ],
    model: completionConfig.model,
    stream: false,
    tools: completionConfig.tools,
    response_format: zodResponseFormat(z.object({
      message: z.string().describe("Your answer")
    }), "answer"),
  });

  const result = completion.choices[0].message.parsed

  return {
    name: completionConfig.name,
    role: "assistant",
    content: JSON.stringify(result)
  }
}

export const toolCompletion = async (completionConfig: ICompletionConfig): Promise<IMessage> => {
  const completion = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "system",
        content: completionConfig.task,
      },
      ...completionConfig.history
    ],
    model: completionConfig.model,
    stream: false,
    tools: completionConfig.tools?.map(tool => tool.functionDefinition),
    response_format: zodResponseFormat(completionConfig.outputSchema, "result"),
  });

  const toolChoice = completion.choices[0].message.tool_calls[0]

  const tool = completionConfig.tools?.find(tool => tool.name === toolChoice.function.name)
  logger.tool(tool.name)
  const result = tool.fn(toolChoice.function.parsed_arguments)

  return {
    name: completionConfig.name,
    role: "system",
    content: JSON.stringify(result),
  }
}