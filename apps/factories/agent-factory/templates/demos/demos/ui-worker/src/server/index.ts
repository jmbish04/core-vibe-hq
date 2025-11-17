import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod/v3";
import type { Variables } from "./types/hono";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use(cors());

const draftSchema = z.object({
	draft: z.string(),
});

const evaluationSchema = z.object({
	feedback: z.string(),
	needsRevision: z.boolean(),
});

const optimizedSchema = z.object({
	optimizedDraft: z.string(),
});

app.post("/api", async (c) => {
	const { prompt } = (await c.req.json()) as { prompt: string };
	const openai = createOpenAI({
		apiKey: c.env.OPENAI_API_KEY,
	});
	const bigModel = openai("gpt-4o");
	const smallModel = openai("gpt-4o-mini");

	console.log("generating draft...", prompt);

	// --- Step 1: Generate the Initial Draft ---
	const draftPrompt = `Please generate an initial draft for the following task:\n\n${prompt}\n\n
		Return your response as a JSON object in the format { "draft": "Your initial draft here." }`;
	const { object: draftObj } = await generateObject({
		model: smallModel,
		schema: draftSchema,
		prompt: draftPrompt,
	});

	console.log("evaluating draft...");

	// --- Step 2: Evaluate the Draft ---
	const evaluationPrompt = `Please evaluate the following draft and provide constructive feedback on how to improve it:\n\n
		${draftObj.draft}\n\n
		Return your evaluation as a JSON object in the format { "feedback": "Your feedback here.", "needsRevision": true/false }`;
	const { object: evaluationObj } = await generateObject({
		model: smallModel,
		schema: evaluationSchema,
		prompt: evaluationPrompt,
	});

	console.log("optimizing draft...");

	// --- Step 3: Optimize the Draft (if necessary) ---
	let optimizedResult = { optimizedDraft: draftObj.draft };
	if (evaluationObj.needsRevision) {
		const optimizerPrompt = `Based on the following initial draft and evaluator feedback, please produce an improved version:\n\n
			Initial Draft:\n${draftObj.draft}\n\n
			Evaluator Feedback:\n${evaluationObj.feedback}\n\n
			Return your optimized draft as a JSON object in the format { "optimizedDraft": "Your optimized draft here." }`;
		const { object } = await generateObject({
			model: bigModel,
			schema: optimizedSchema,
			prompt: optimizerPrompt,
		});
		optimizedResult = object;
	}

	console.log("done");

	return c.json({
		initialDraft: draftObj.draft,
		evaluation: evaluationObj,
		finalDraft: optimizedResult.optimizedDraft,
	});
});

export default {
	fetch: app.fetch,
} satisfies ExportedHandler<Env>;
