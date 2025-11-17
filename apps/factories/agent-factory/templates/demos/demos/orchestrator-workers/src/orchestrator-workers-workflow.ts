import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import z from "zod";

export type OrchestratorWorkersWorkflowParams = {
	prompt: string;
};

const orchestratorSchema = z.object({
	tasks: z.array(z.string()),
});

const workerOutputSchema = z.object({
	response: z.string(),
});

const aggregatorSchema = z.object({
	finalResult: z.string(),
});

export class OrchestratorWorkersWorkflow extends WorkflowEntrypoint<
	Env,
	OrchestratorWorkersWorkflowParams
> {
	async run(event: WorkflowEvent<OrchestratorWorkersWorkflowParams>, step: WorkflowStep) {
		const { prompt } = event.payload;

		const workersai = createWorkersAI({ binding: this.env.AI });
		const bigModel = workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
		const smallModel = workersai("@cf/meta/llama-3.1-8b-instruct");

		// --- Step 1: Orchestrator Generates Subtasks ---
		const orchestratorResult = await step.do("generate subtasks", async () => {
			const orchestratorPrompt = `Given the following complex coding task:\n\n${prompt}\n\nPlease break it down into a list of subtasks needed to complete the task. Return your answer as a JSON object in the format { "tasks": ["Task 1", "Task 2", ...] }`;
			const { object } = await generateObject({
				model: bigModel,
				schema: orchestratorSchema,
				prompt: orchestratorPrompt,
			});
			return object;
		});

		// --- Step 2: Workers Execute Each Subtask in Parallel ---
		const workerResponses = await step.do("execute subtasks in parallel", async () => {
			const workerPromises = orchestratorResult.tasks.map(async (taskPrompt) => {
				const workerLLMPrompt = `You are a specialised coding assistant. Please complete the following subtask:\n\n${taskPrompt}\n\nReturn your result as a JSON object in the format { "response": "Your detailed response here." }`;
				const { object } = await generateObject({
					model: smallModel,
					schema: workerOutputSchema,
					prompt: workerLLMPrompt,
				});

				return object.response;
			});
			return Promise.all(workerPromises);
		});

		// --- Step 3: Aggregator Synthesises the Worker Responses ---
		const aggregatorResult = await step.do("synthesise responses", async () => {
			const aggregatorPrompt = `The following are responses from various workers addressing subtasks for a complex coding task:\n\n
				${workerResponses.map((resp, index) => `Subtask ${index + 1}: ${resp}`).join("\n\n")}
				\n\nPlease synthesise these responses into a single, comprehensive final result.
				Return your answer as a JSON object in the format { "finalResult": "Your comprehensive result here." }`;
			const { object } = await generateObject({
				model: bigModel,
				schema: aggregatorSchema,
				prompt: aggregatorPrompt,
			});
			return object;
		});

		return {
			orchestratorTasks: orchestratorResult.tasks,
			workerResponses,
			finalResult: aggregatorResult.finalResult,
		};
	}
}
