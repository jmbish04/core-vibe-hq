import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DevServerTestHelper } from "../../../libs/test-utils/src/DevServerTestHelper";

const TEST_ITERATIONS = 4;
const PASSING_THRESHOLD = 0.75; // 75% pass rate required

describe("Weather Worker Integration Tests", () => {
	const serverHelper = new DevServerTestHelper();
	let serverUrl: string;

	beforeAll(async () => {
		serverUrl = await serverHelper.start();
	}, 45000);

	afterAll(() => {
		serverHelper.stop();
	});

	async function runReliabilityTest({
		testName,
		prompt,
		expectedKeywords,
	}: {
		testName: string;
		prompt: string;
		expectedKeywords: string[];
	}) {
		const results = [];

		for (let i = 0; i < TEST_ITERATIONS; i++) {
			try {
				const response = await fetch(serverUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ prompt }),
				});

				if (!response.ok) {
					throw new Error(`HTTP error: ${response.status}`);
				}

				const data = await response.json<{ text: string }>();
				const content = data.text.toLowerCase();

				const hasExpectedKeyword = expectedKeywords.some((keyword) =>
					content.includes(keyword),
				);

				results.push(hasExpectedKeyword);
			} catch (error) {
				console.error(`Iteration ${i} failed:`, error);
				results.push(false);
			}
		}

		const successRate = results.filter(Boolean).length / results.length;
		console.log(`${testName} success rate: ${successRate * 100}%`);

		expect(successRate).toBeGreaterThanOrEqual(PASSING_THRESHOLD);
	}

	test(
		"should correctly identify rainy weather in London",
		async () => {
			await runReliabilityTest({
				testName: "London Weather Test",
				prompt: "What is the weather in London?",
				expectedKeywords: ["rain", "raining", "rainy"],
			});
		},
		{ timeout: 90000 },
	);

	test(
		"should correctly identify sunny weather in Paris",
		async () => {
			await runReliabilityTest({
				testName: "Paris Weather Test",
				prompt: "What is the weather in Paris?",
				expectedKeywords: ["sun", "sunny", "sunshine"],
			});
		},
		{ timeout: 500000 },
	);
});
