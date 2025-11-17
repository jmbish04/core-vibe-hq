import { generateObject, type LanguageModel } from "ai";
import z from "zod";

export async function extractAlarmType(model: LanguageModel, query: string) {
	const { object } = await generateObject({
		model,
		schema: z.object({
			type: z.string(),
		}),
		prompt: `
			You are an intelligent alarm scheduler manager. What follows is a user prompt for creating an alarm. Your job is to extract a "type" of alarm.
			The types of alarm available are:

			"scheduled" - this is where there is a specific time mentioned that they want the alarm to sound. E.g. please set an alarm for 12pm tomorrow.
			"delayed" - this is when there is an offset - e.g. please set an alarm for 10 seconds time.
			"cron" - this is for a regularly scheduled alarm. e.g. please set an alarm to go off every minute.

			Prompt: "${query}"

			Respond with a JSON object:

			- If you can extract a message and type of schedule:
			  { "type": "[type of schedule]"}
			- If not:
			  { "type": undefined }

			Example:

			User prompt: please remind me to take the bins out on Sunday night
			Your response: { type: "scheduled" }

			User prompt: set an alarm for 12pm every Tuesday
			Your response: { type: "cron" }

			User prompt: remind me in 10 minutes to turn off the oven
			Your response: { type: "delayed" }
        `,
	});

	return object.type;
}
