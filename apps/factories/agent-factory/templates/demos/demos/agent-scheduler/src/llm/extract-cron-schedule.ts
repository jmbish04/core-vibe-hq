import { generateObject, type LanguageModel } from "ai";
import z from "zod";

export async function extractCronSchedule(model: LanguageModel, query: string) {
	const { object } = await generateObject({
		model,
		schema: z.object({
			cron: z.string(),
		}),
		prompt: `
			You are an intelligent alarm scheduler manager. What follows is a user prompt for creating an alarm at a regular schedule. Your job is to convert that regular schedule into a cron string.

			Please follow these steps:
			1. Parse the natural language prompt which specifies a regular schedule for an alarm.
			2. Calculate the exact interval for the regular schedule.
			3. Convert to cron format, e.g. "5 0 0 0 0 0".
			4. Show your reasoning step-by-step before providing the final answer.

			Return only the cron string as your final answer.

			Prompt: "${query}"

			Respond with a JSON object:

			- If you can extract a time:
			  { "cron": "[the extracted cron string]"}
			- If not:
			  { "cron": undefined }

			Examples
			1. Remind me to stand u every minute.
				* * * * *

			2. Set an alarm to get up at 8:00 AM every day.
				0 8 * * *

			3. Pick up the kids at 2:15 PM every Monday, Wednesday, Friday.
				15 14 1,3,5 * *

			4. Beware the ides of the month every hour on the 15th day of every month.
				0 0 15 * *

			5. Remind me of some random thing that happens every 5 minutes on the 2nd day of every month.
				*/5 0 2 * *

			6. It's a strange time to go to church, but please remind me every Sunday at 3:00 AM.
				0 3 * * 0

			7. Run a command at 9:00 PM on the last day of every month.
				0 21 L * *

			8. Run a command at 10:00 PM on the 1st day of every month.
				0 22 1 * *
			`,
	});

	return object.cron;
}
