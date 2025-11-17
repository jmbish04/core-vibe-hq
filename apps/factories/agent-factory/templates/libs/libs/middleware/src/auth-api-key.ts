import type { Context } from "hono";

export async function authApiKey(
	c: Context<{
		Bindings: any;
		Variables: any;
	}>,
	next: () => Promise<void>,
) {
	if (c.env.ENVIRONMENT === "development") {
		return await next();
	}

	if (!c.env.API_KEY) {
		return c.json({ error: "API key not set" }, 500);
	}

	if (c.env.API_KEY !== c.req.header("x-api-key")) {
		return c.json({ error: "Invalid API key" }, 401);
	}

	await next();
}
