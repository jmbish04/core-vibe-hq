import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import z from "zod";

export type EvaluatorOptimiserWorkflowParams = {
	prompt: string;
};

// Schema for the initial draft output.
const draftSchema = z.object({
	draft: z.string(),
});

// Schema for the evaluator's feedback.
const evaluationSchema = z.object({
	feedback: z.string(),
	needsRevision: z.boolean(),
});

// Schema for the optimized final output.
const optimizedSchema = z.object({
	optimizedDraft: z.string(),
});

export class EvaluatorOptimiserWorkflow extends WorkflowEntrypoint<
	Env,
	EvaluatorOptimiserWorkflowParams
> {
	async run(event: WorkflowEvent<EvaluatorOptimiserWorkflowParams>, step: WorkflowStep) {
		const { prompt } = event.payload;

		const workersai = createWorkersAI({ binding: this.env.AI });
		const bigModel = workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
		const smallModel = workersai("@cf/meta/llama-3.1-8b-instruct");

		// --- Step 1: Generate the Initial Draft ---
		const draftPrompt = `Please generate an initial draft for the following task:\n\n${prompt}\n\n
		Return your response as a JSON object in the format { "draft": "Your initial draft here." }`;

		const draftObj = await step.do("generate draft", async () => {
			const { object } = await generateObject({
				model: smallModel,
				schema: draftSchema,
				prompt: draftPrompt,
			});
			return object;
		});

		// --- Step 2: Evaluate the Draft ---
		const evaluationPrompt = `Please evaluate the following draft and provide constructive feedback on how to improve it:\n\n
		${draftObj.draft}\n\n
		Return your evaluation as a JSON object in the format { "feedback": "Your feedback here.", "needsRevision": true/false }`;

		const evaluationObj = await step.do("evaluate draft", async () => {
			const { object } = await generateObject({
				model: smallModel,
				schema: evaluationSchema,
				prompt: evaluationPrompt,
			});
			return object;
		});

		// --- Step 3: Optimize the Draft (if necessary) ---
		let optimizedResult = { optimizedDraft: draftObj.draft };
		if (evaluationObj.needsRevision) {
			const optimizerPrompt = `Based on the following initial draft and evaluator feedback, please produce an improved version:\n\n
			Initial Draft:\n${draftObj.draft}\n\n
			Evaluator Feedback:\n${evaluationObj.feedback}\n\n
			Return your optimized draft as a JSON object in the format { "optimizedDraft": "Your optimized draft here." }`;

			const optimizedDraft = await step.do("optimize draft", async () => {
				const { object } = await generateObject({
					model: bigModel,
					schema: optimizedSchema,
					prompt: optimizerPrompt,
				});

				return object.optimizedDraft;
			});
			optimizedResult = { optimizedDraft };
		}

		return {
			initialDraft: draftObj.draft,
			evaluation: evaluationObj,
			finalDraft: optimizedResult.optimizedDraft,
		};
	}
}
