/**
 * @shared/base/agents/tools/sharedToolkit.ts
 *
 * Shared agent tooling that combines:
 *  - GitHub REST interactions via OpenAPI-generated tool definitions.
 *  - A KV-backed memory tool so multiple agents can persist shared context.
 *
 * This module can be imported by any worker that has access to an AI binding
 * and a KV namespace (for example the orchestrator can map `VibecoderStore`
 * into `AGENT_SHARED_KV`).
 */

import type { Ai, KVNamespace } from '@cloudflare/workers-types';
import {
	createToolsFromOpenAPISpec,
	runWithTools,
	type Message,
} from '@cloudflare/ai-utils';

const DEFAULT_MODEL = '@hf/nousresearch/hermes-2-pro-mistral-7b';
const APP_NAME = 'cf-fn-calling-example-app';
const GITHUB_OPENAPI_SPEC =
	'https://gist.githubusercontent.com/mchenco/fd8f20c8f06d50af40b94b0671273dc1/raw/f9d4b5cd5944cc32d6b34cad0406d96fd3acaca6/partial_api.github.com.json';

export interface SharedToolkitEnv {
	AI: Ai;
	/**
	 * KV namespace used as shared memory across agents.
	 * Downstream workers should alias their KV binding to this property.
	 */
	AGENT_SHARED_KV: KVNamespace;
}

export interface BuildSharedToolsOptions {
	includeGitHubTools?: boolean;
	includeSharedMemoryTool?: boolean;
}

export interface RunSharedAgentOptions extends BuildSharedToolsOptions {
	model?: string;
	messages: Message[];
	/**
	 * Additional tool definitions that should be merged with the shared defaults.
	 */
	tools?: any[];
}

/**
 * Build the default shared toolset (GitHub REST + KV memory) for use with runWithTools.
 */
export async function buildSharedAgentTools(
	env: SharedToolkitEnv,
	options: BuildSharedToolsOptions = {},
) {
	const tools: any[] = [];
	const { includeGitHubTools = true, includeSharedMemoryTool = true } = options;

	if (includeGitHubTools) {
		const githubTools = await createToolsFromOpenAPISpec(GITHUB_OPENAPI_SPEC, {
			overrides: [
				{
					matcher: ({ url }) => url.hostname === 'api.github.com',
					values: {
						headers: {
							'User-Agent': APP_NAME,
						},
					},
				},
			],
		});
		tools.push(...githubTools);
	}

	if (includeSharedMemoryTool) {
		tools.push({
			name: 'shared_kv_update',
			description:
				'Persist shared agent memory in the KV namespace so other agents can read it later.',
			parameters: {
				type: 'object',
				properties: {
					key: {
						type: 'string',
						description: 'Key to store in the shared agent memory KV namespace.',
					},
					value: {
						type: 'string',
						description: 'Value to persist for the provided key.',
					},
				},
				required: ['key', 'value'],
			},
			function: async ({ key, value }: { key: string; value: string }) => {
				await env.AGENT_SHARED_KV.put(key, value);
				return `Stored value for key "${key}" in shared agent memory.`;
			},
		});
	}

	return tools;
}

/**
 * Run an agent conversation with the shared toolset. Additional tools can be supplied if needed.
 */
export async function runSharedAgentWithTools(
	env: SharedToolkitEnv,
	{
		model = DEFAULT_MODEL,
		messages,
		tools: extraTools = [],
		includeGitHubTools,
		includeSharedMemoryTool,
	}: RunSharedAgentOptions,
) {
	const defaultTools = await buildSharedAgentTools(env, {
		includeGitHubTools,
		includeSharedMemoryTool,
	});

	const tools = [...defaultTools, ...extraTools];

	return runWithTools(env.AI, model, {
		messages,
		tools,
	});
}
