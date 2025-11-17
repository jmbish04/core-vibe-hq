import { renderHtml } from "./renderHtml";
import { initDb } from "./db/client";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const db = initDb(env);

		// Use Drizzle for simple queries
		// const comments = await db.drizzle.select().from(schema.comments).limit(3);

		// Use Kysely for dynamic queries
		const comments = await db.kysely
			.selectFrom('comments')
			.selectAll()
			.limit(3)
			.execute();

		return new Response(renderHtml(JSON.stringify(comments, null, 2)), {
			headers: {
				"content-type": "text/html",
			},
		});
	},
} satisfies ExportedHandler<Env>;