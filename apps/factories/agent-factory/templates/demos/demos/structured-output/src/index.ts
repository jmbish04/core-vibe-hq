import { generateObject } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createWorkersAI } from "workers-ai-provider";
import z from "zod";
import type { Variables } from "./types/hono";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use(cors());
app.get("/", (c) => c.json("ok"));

app.post("/", async (c) => {
	const { prompt } = (await c.req.json()) as { prompt: string };
	const workersai = createWorkersAI({ binding: c.env.AI });
	const { object } = await generateObject({
		model: workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
		schema: z.object({
			recipe: z.object({
				name: z.string(),
				ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
				steps: z.array(z.string()),
			}),
		}),
		prompt,
	});

	return c.json(object);
});

export default {
	fetch: app.fetch,
} satisfies ExportedHandler<Env>;
