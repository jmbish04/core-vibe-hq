import { generateObject, type LanguageModel } from "ai";
import z from "zod";

export async function extractAlarmMessage(model: LanguageModel, query: string) {
	const { object } = await generateObject({
		model,
		schema: z.object({
			message: z.string(),
		}),
		prompt: `
			You are an intelligent alarm scheduler manager. What follows is a user prompt for creating an alarm. Your job is to extract a message to relay to the user when the alarm is triggered.

			Prompt: "${query}"

			Respond with a JSON object:

			- If you can extract a message for the alarm:
			{ "message": "[message]" }
			- If not:
			{ "message": undefined }

			Example:

			User prompt: please remind me to take the bins out on Sunday night
			Your response: { "message": "Take the bins out" }

			User prompt: set an alarm for 12pm every Tuesday
			Your response: { "message": "alarm" }

			User prompt: remind me in 10 minutes to turn off the oven
			Your response: { "message": "Turn off the oven" }
        `,
	});

	return object.message;
}
