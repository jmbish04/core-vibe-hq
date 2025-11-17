import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Variables } from "./types/hono";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use(cors());

const weatherTool = {
	name: "get_weather",
	description: "Gets the weather for a specified location",
	parameters: {
		type: "object",
		properties: {
			location: {
				type: "string",
				description: "The location to get the weather for.",
			},
		},
		required: ["location"],
	},
};

app.post("/", async (c) => {
	const { prompt } = (await c.req.json()) as { prompt: string };
	const messages = [{ role: "user", content: prompt }];
	const tools = [weatherTool];

	const response = await c.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
		messages,
		tools,
	});

	if (response instanceof ReadableStream) {
		throw new Error("This shouldn't happen");
	}

	const selected_tool = response.tool_calls?.[0] as {
		name: string;
		arguments: { location: string };
	};
	const res =
		selected_tool?.name === "get_weather" && selected_tool.arguments.location === "London"
			? "Raining"
			: "Sunny";

	const finalResponse = await c.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
		messages: [
			...messages,
			{
				role: "assistant",
				content: JSON.stringify(selected_tool),
			},
			{
				role: "tool",
				content: JSON.stringify(res),
			},
		],
		tools,
		stream: true,
	});

	if (!(finalResponse instanceof ReadableStream)) {
		throw new Error("This shouldn't happen");
	}

	return new Response(finalResponse);
});

export default {
	fetch: app.fetch,
} satisfies ExportedHandler<Env>;
