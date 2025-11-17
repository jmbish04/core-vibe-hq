import { generateObject, type LanguageModel } from "ai";
import z from "zod";

export async function extractScheduledDate(model: LanguageModel, query: string) {
	const { object } = await generateObject({
		model,
		schema: z.object({
			datetime: z.string(),
		}),
		prompt: `
			You are an intelligent alarm scheduler manager. What follows is a user prompt for creating an alarm at a specific time in the future. Your job is to extract the ISO Date Time that is mentioned in the prompt.
			The current date/time in ISO 8601 format is ${new Date().toISOString()}.

			Please follow these steps:
			1. Parse the natural language prompt which specifies a point in time in the future.
			2. Calculate the exact date and time that is specified.
			3. Convert to ISO 8601 format (YYYY-MM-DDThh:mm:ssZ).
			4. Show your reasoning step-by-step before providing the final answer.

			Return only the ISO date/time string as your final answer.

			Prompt: "${query}"

			Respond with a JSON object:

			- If you can extract a time:
			  { "datetime": "[the extracted date/time in ISO 8601 format]"}
			- If not:
			  { "datetime": undefined }
			`,
	});

	return object.datetime;
}
