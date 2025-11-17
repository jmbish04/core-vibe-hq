import { env } from "cloudflare:workers";
import { generateText } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createWorkersAI } from "workers-ai-provider";
import type { Variables } from "./types/hono";

const workersAI = createWorkersAI({
	binding: env.AI,
});

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use(cors());

// Health check endpoint
app.get("/", (c) => c.json("ok"));

// Image analysis endpoint
app.post("/analyze", async (c) => {
	try {
		const formData = await c.req.formData();
		const image = formData.get("image") as File;

		if (!image) {
			return c.json({ error: "No image provided" }, 400);
		}

		// // The first time you use the model, you need to accept Meta's terms and conditions
		// // Uncomment this code to agree to the terms and conditions
		// const agreeResponse = await env.AI.run(
		// 	"@cf/meta/llama-3.2-11b-vision-instruct",
		// 	{
		// 		prompt: "agree",
		// 	},
		// );

		const response = await generateText({
			messages: [
				{
					content:
						"You are a helpful assistant that analyzes images and returns a description of the image.",
					role: "system",
				},
				{
					content: [
						{
							image: await image.arrayBuffer(),
							type: "image",
						},
					],
					role: "user",
				},
			],
			// @ts-expect-error is it not in the types yet?
			model: workersAI("@cf/meta/llama-3.2-11b-vision-instruct"),
		});

		return c.json({
			analysis: response.text,
			imageSize: image.size,
			imageType: image.type,
			success: true,
		});
	} catch (error) {
		console.error("Error processing image:", error);
		return c.json({ error: (error as Error).message || "Failed to process image" }, 500);
	}
});

export default {
	fetch: app.fetch,
} satisfies ExportedHandler<Env>;
