import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import z from "zod";

export type PromptChainingWorkflowParams = {
	prompt: string;
};

const outlineSchema = z.object({
	outline: z.array(z.string()),
});

const criteriaSchema = z.object({
	meetsCriteria: z.boolean(),
});

const documentationSchema = z.object({
	documentation: z.string(),
});

export class PromptChainingWorkflow extends WorkflowEntrypoint<Env, PromptChainingWorkflowParams> {
	async run(event: WorkflowEvent<PromptChainingWorkflowParams>, step: WorkflowStep) {
		const { prompt } = event.payload;

		const workersai = createWorkersAI({ binding: this.env.AI });
		const model = workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast");

		// Step 1: Generate the outline for the technical documentation.
		const outlineObj = await step.do("generate outline", async () => {
			const outlinePrompt = `${prompt}\n\nPlease generate a detailed outline for the technical documentation.`;
			const { object } = await generateObject({
				model,
				schema: outlineSchema,
				prompt: outlinePrompt,
			});
			return object;
		});

		// Step 2: Evaluate the generated outline against the criteria.
		const criteriaObj = await step.do("evaluate outline", async () => {
			const criteriaPrompt = `Please evaluate the following technical documentation outline against our criteria:\n\n${JSON.stringify(outlineObj)}\n\nReturn a JSON object with a boolean field "meetsCriteria" that is true if the outline meets the criteria, or false otherwise.`;
			const { object } = await generateObject({
				model,
				schema: criteriaSchema,
				prompt: criteriaPrompt,
			});
			return object;
		});

		if (!criteriaObj.meetsCriteria) {
			return { error: "Outline does not meet the criteria." };
		}

		// Step 3: Generate the full technical documentation using the approved outline.
		const documentationObj = await step.do("generate documentation", async () => {
			const documentationPrompt = `Using the following approved outline for technical documentation:\n\n${JSON.stringify(outlineObj)}\n\nPlease generate the full technical documentation in a detailed and organised manner.`;
			const { object } = await generateObject({
				model,
				schema: documentationSchema,
				prompt: documentationPrompt,
			});
			return object;
		});

		return {
			outline: outlineObj,
			criteria: criteriaObj,
			documentation: documentationObj,
		};
	}
}
