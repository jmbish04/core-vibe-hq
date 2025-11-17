import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import z from "zod";

export type RoutingWorkflowParams = {
	prompt: string;
};

const gradeSchema = z.object({
	grade: z.number().min(0).max(100),
});

const finalOutputSchema = z.object({
	result: z.string(),
});

export class RoutingWorkflow extends WorkflowEntrypoint<Env, RoutingWorkflowParams> {
	async run(event: WorkflowEvent<{ prompt: string }>, step: WorkflowStep) {
		const { prompt } = event.payload;

		const workersai = createWorkersAI({ binding: this.env.AI });
		const bigModel = workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
		const smallModel = workersai("@cf/meta/llama-3.1-8b-instruct");

		// Step 1: Grade the prompt using the smaller model.
		const gradeObj = await step.do("grade prompt", async () => {
			const gradePrompt = `Please evaluate the following prompt and assign a grade between 0 and 100 based on its complexity and difficulty. A higher number = more complex and difficult:\n\n${prompt}\n\nReturn a JSON object like { "grade": 75 } where the number represents the grade.`;
			const { object } = await generateObject({
				model: smallModel,
				schema: gradeSchema,
				prompt: gradePrompt,
			});
			return object;
		});

		const selectedModel = gradeObj.grade > 50 ? bigModel : smallModel;

		// Step 2: Generate the final detailed response.
		const finalObj = await step.do("generate final output", async () => {
			const finalPrompt = `Using the prompt provided below, please produce a detailed and well-formulated response:\n\n${prompt}\n\nPlease return your result as a JSON object like { "result": "Your detailed response here." }`;
			const { object } = await generateObject({
				model: selectedModel,
				schema: finalOutputSchema,
				prompt: finalPrompt,
			});
			return object;
		});

		return {
			grade: gradeObj,
			selectedModel:
				gradeObj.grade > 50
					? "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
					: "@cf/meta/llama-3.1-8b-instruct",
			finalOutput: finalObj,
		};
	}
}
