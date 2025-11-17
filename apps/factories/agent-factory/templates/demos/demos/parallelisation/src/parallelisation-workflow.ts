import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import z from "zod";

export type ParallelisationWorkflowParams = {
	prompt: string;
};

const angleSchema = z.object({
	angleOutput: z.string(),
});

const finalOutputSchema = z.object({
	finalResult: z.string(),
});

export class ParallelisationWorkflow extends WorkflowEntrypoint<
	Env,
	ParallelisationWorkflowParams
> {
	async run(event: WorkflowEvent<ParallelisationWorkflowParams>, step: WorkflowStep) {
		const { prompt } = event.payload;

		// Initialise Workers AI using the AI binding from the environment.
		const workersai = createWorkersAI({ binding: this.env.AI });
		const bigModel = workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
		const smallModel = workersai("@cf/meta/llama-3.1-8b-instruct");

		// Step 1: Execute Parallel Calls (Voting)
		const anglePrompts = [
			`Angle 1: Analyse the following prompt from a technical perspective and provide a detailed response:\n\n${prompt}`,
			`Angle 2: Analyse the following prompt from a creative perspective and provide a detailed response:\n\n${prompt}`,
			`Angle 3: Analyse the following prompt from a user-centric perspective and provide a detailed response:\n\n${prompt}`,
		];

		// Run the three small LLM calls concurrently.
		const angleOutputs = await step.do("parallel angle calls", async () => {
			const calls = anglePrompts.map(async (anglePrompt) => {
				const { object } = await generateObject({
					model: smallModel,
					schema: angleSchema,
					prompt: anglePrompt,
				});

				return object.angleOutput;
			});

			return await Promise.all(calls);
		});

		// Step 2: Aggregation via a Larger LLM.
		const aggregatorResult = await step.do("aggregate responses", async () => {
			const aggregatorPrompt = `The following responses provide diverse perspectives on a given prompt:\n\n
				${angleOutputs.map((output, index) => `Response ${index + 1}: ${output}`).join("\n\n")}
				\n\nBased on these responses, please synthesise a comprehensive final result.
				Return your answer as a JSON object in the format { "finalResult": "Your comprehensive result here." }`;

			const { object } = await generateObject({
				model: bigModel,
				schema: finalOutputSchema,
				prompt: aggregatorPrompt,
			});
			return object;
		});

		// Return the individual perspectives and the aggregator's result.
		return {
			angleOutputs,
			aggregatorResult,
		};
	}
}
