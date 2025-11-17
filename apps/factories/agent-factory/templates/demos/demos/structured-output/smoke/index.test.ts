import { afterAll, beforeAll, describe, expect, test } from "vitest";
import z from "zod";
import { DevServerTestHelper } from "../../../libs/test-utils/src/DevServerTestHelper";

const TEST_ITERATIONS = 4;
const PASSING_THRESHOLD = 0.75; // 75% pass rate required

describe("Structured Outputs Integration Tests", () => {
	const serverHelper = new DevServerTestHelper();
	let serverUrl: string;

	beforeAll(async () => {
		serverUrl = await serverHelper.start();
	}, 45000);

	afterAll(() => {
		serverHelper.stop();
	});

	test(
		"should return correct object structure",
		async () => {
			// Define the schema to validate the JSON
			const schema = z.object({
				recipe: z.object({
					name: z.string(),
					ingredients: z.array(
						z.object({ name: z.string(), amount: z.string() })
					),
					steps: z.array(z.string()),
				}),
			});

			const results: boolean[] = [];

			for (let i = 0; i < TEST_ITERATIONS; i++) {
				try {
					// Attempt to fetch from the local dev server
					const response = await fetch(`${serverUrl}/`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							prompt: "Create a recipe for sourdough bread.",
						}),
					});

					if (!response.ok) {
						throw new Error(`HTTP error: ${response.status}`);
					}

					const data = await response.json();
					const { success } = schema.safeParse(data);
					results.push(success);
				} catch (error) {
					console.error(`Iteration ${i} failed:`, error);
					results.push(false);
				}
			}

			const successRate = results.filter(Boolean).length / results.length;
			expect(successRate).toBeGreaterThanOrEqual(PASSING_THRESHOLD);
		},
		{ timeout: 500000 }
	);
});
