import Groq from "groq-sdk";  // Import Groq client library
import 'dotenv/config';  // Loads environment variables from .env
import { Logger } from "../helper/logger";
import { z } from "zod";

const groq = new Groq();  // Initialize Groq client
const logger = new Logger();

export async function groqCompletion(completionConfig: ICompletionConfig): Promise<IMessage | undefined> {
  try {
    const completionTypeMap: Record<EOutput, (config: ICompletionConfig) => Promise<any>> = {
      'json': structuredCompletion,
      'text': textCompletion,
      'tool_call': toolCompletion,
    };

    const completionType = completionTypeMap[completionConfig.outputType];
    if (!completionType) {
      throw new Error(`Unsupported output type: ${completionConfig.outputType}`);
    }

    const result = await completionType(completionConfig);
    return result;
  } catch (error) {
    console.error("Error:", error);
  }
}

export const structuredCompletion = async (completionConfig: ICompletionConfig): Promise<IMessage> => {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `${completionConfig.task} You have to respond in the following JSON Format:  ${completionConfig.outputSchema}`,
      },
      ...completionConfig.history
    ],
    model: completionConfig.model,
    stream: false,
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(JSON.stringify(completion.choices[0].message.content))

  return {
    name: completionConfig.name,
    role: "assistant",
    content: result
  };
}

export const textCompletion = async (completionConfig: ICompletionConfig): Promise<IMessage> => {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `${completionConfig.task} You have to respond in the following JSON Format: z.object({
          message: z.string().describe("Your answer")
        })`,
      },
      ...completionConfig.history
    ],
    model: completionConfig.model,
    stream: false,
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(JSON.stringify(completion.choices[0].message.content))

  return {
    name: completionConfig.name,
    role: "assistant",
    content: result
  };
}

export const toolCompletion = async (completionConfig: ICompletionConfig): Promise<IMessage> => {

  if (!Array.isArray(completionConfig.tools)) {
    throw new Error(`Tools configuration is invalid for agent "${completionConfig.name}". Expected an array.`);
  }


  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: completionConfig.task,
      },
      ...completionConfig.history
    ],
    model: completionConfig.model,
    stream: false,
    tools: completionConfig.tools.map(tool => tool.functionDefinition),
    tool_choice: "auto",
  });

  if (completion.choices[0].message.tool_calls) {
    const toolCall = completion.choices[0].message.tool_calls[0];
    const tool = completionConfig.tools.find(tool => tool.name === toolCall.function.name);
    logger.tool(tool.name);
    const result = await tool.fn(toolCall.function.arguments);
    return {
      name: completionConfig.name,
      role: "system",
      content: JSON.stringify(result),
    };
  }

  return {
    name: completionConfig.name,
    role: "system",
    content: "no tool called",
  };
}
