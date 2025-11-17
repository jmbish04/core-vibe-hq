import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import z from "zod";
import type { Variables } from "./types/hono";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use(cors());

/**
 * POST /update
 * Fetches the model map from GitHub and saves it into the KV store.
 */
app.post("/update", async (c) => {
	const map = await fetchModelsAsJsonMap(c.env.GITHUB_TOKEN);
	const dataObj = Object.fromEntries(map);

	await c.env.JSON_DATA.put("models", JSON.stringify(dataObj));
	return c.json({ success: true });
});

/**
 * POST /query
 * Accepts a prompt and returns a response based on the available models data.
 */
app.post("/query", async (c) => {
	const { prompt } = (await c.req.json()) as { prompt: string };
	const openai = createOpenAI({
		apiKey: c.env.OPENAI_API_KEY,
	});
	const model = openai("gpt-4o-mini");

	const modelsData = await c.env.JSON_DATA.get("models");
	if (!modelsData) {
		return c.json({ error: "No models data found" }, 404);
	}
	const modelsObj: Record<string, any> = JSON.parse(modelsData);

	const criteriaSchema = z.object({
		structured: z.boolean(),
	});
	const criteriaPrompt = `Please evaluate the following prompt:\n\n${JSON.stringify(
		prompt,
	)}\n\nReturn a JSON object with a boolean field "structured" that is true if the prompt would be best returned as a JSON structured response, or false if it should just return a text-based response.`;
	const { object: evaluationObject } = await generateObject({
		model,
		schema: criteriaSchema,
		maxRetries: 5,
		prompt: criteriaPrompt,
	});

	if (evaluationObject.structured) {
		const { object } = await generateObject({
			model,
			schema: z.object({
				response: z.any(),
			}),
			maxRetries: 5,
			prompt: `
		Using the available models data, please answer the following prompt:
		${prompt}

		Models Data:
		${JSON.stringify(modelsObj)}
		`,
		});

		return c.json(object);
	}

	const response = await generateText({
		model,
		prompt: `
		Using the available models data, please answer the following prompt:
		${prompt}

		Models Data:
		${JSON.stringify(modelsObj)}
		`,
	});

	return c.json({ response });
});

/**
 * GET /models_by_task?task=...
 * Returns an array of models whose task.id matches the provided task parameter.
 */
app.get("/models_by_task", async (c) => {
	const taskId = c.req.query("task");
	if (!taskId) {
		return c.json({ error: "Missing task parameter" }, 400);
	}

	const modelsData = await c.env.JSON_DATA.get("models");
	if (!modelsData) {
		return c.json({ error: "No models data found" }, 404);
	}
	const modelsObj: Record<string, any> = JSON.parse(modelsData);

	const filtered = Object.values(modelsObj).filter(
		(model: any) => model.task && model.task.id === taskId,
	);
	return c.json(filtered);
});

/**
 * GET /models_by_capability?capability=...
 * Currently supports the "tools" capability: returns models that support tool calling.
 */
app.get("/models_by_capability", async (c) => {
	const capability = c.req.query("capability");
	if (!capability) {
		return c.json({ error: "Missing capability parameter" }, 400);
	}

	const modelsData = await c.env.JSON_DATA.get("models");
	if (!modelsData) {
		return c.json({ error: "No models data found" }, 404);
	}
	const modelsObj: Record<string, any> = JSON.parse(modelsData);

	const filtered = Object.values(modelsObj).filter((model: any) => {
		if (capability === "tools") {
			return supportsToolCalling(model);
		}
		return false;
	});
	return c.json(filtered);
});

export default {
	fetch: app.fetch,
} satisfies ExportedHandler<Env>;

/**
 * Helper function to determine if a model supports tool calling.
 * Checks whether the model's input schema contains a "tools" property.
 */
function supportsToolCalling(model: any): boolean {
	if (!model.schema || !model.schema.input) {
		return false;
	}
	const inputSchema = model.schema.input;

	if (inputSchema.properties?.tools) {
		return true;
	}

	if (inputSchema.oneOf && Array.isArray(inputSchema.oneOf)) {
		console.log(true);
		return inputSchema.oneOf.some((option: any) => option.properties?.tools);
	}
	return false;
}

type GitHubFile = {
	name: string;
	path: string;
	download_url: string;
};

/**
 * Fetches JSON files from GitHub and creates a Map keyed by the filename (without extension)
 * and the parsed JSON object as the value.
 */
async function fetchModelsAsJsonMap(token: string): Promise<Map<string, any>> {
	const apiUrl =
		"https://api.github.com/repos/cloudflare/cloudflare-docs/contents/src/content/workers-ai-models?ref=production";

	// Map to store the filename and parsed JSON object.
	const fileMap = new Map<string, any>();

	try {
		const response = await fetch(apiUrl, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"User-Agent": "model-scraper",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});
		if (!response.ok) {
			throw new Error(
				`Failed to fetch folder contents: ${response.status} - ${response.statusText}`,
			);
		}

		const folderContents = (await response.json()) as GitHubFile[];

		for (const file of folderContents) {
			if (file.name.endsWith(".json")) {
				const fileResponse = await fetch(file.download_url, {
					method: "GET",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
						Accept: "application/vnd.github+json",
						"User-Agent": "model-scraper",
						"X-GitHub-Api-Version": "2022-11-28",
					},
				});
				if (!fileResponse.ok) {
					console.error(
						`Failed to fetch file ${file.name}: ${fileResponse.status} - ${fileResponse.statusText}`,
					);
					continue;
				}
				const fileContents = await fileResponse.json();
				const filenameWithoutExtension = file.name.split(".").slice(0, -1).join("");
				fileMap.set(filenameWithoutExtension, fileContents);
			}
		}
	} catch (error) {
		console.error("Error while creating JSON Map from GitHub:", error);
	}

	return fileMap;
}
