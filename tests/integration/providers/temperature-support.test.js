/**
 * Integration Tests for Provider Temperature Support
 *
 * This test suite verifies that all providers correctly declare their
 * temperature support capabilities. CLI providers should have
 * supportsTemperature = false, while standard API providers should
 * have supportsTemperature = true.
 *
 * These tests are separated from unit tests to avoid coupling
 * base provider tests with concrete provider implementations.
 */

import { ClaudeCodeProvider } from '@tmstaging/src/ai-providers/claude-code.js';
import { CodexCliProvider } from '@tmstaging/src/ai-providers/codex-cli.js';
import { GeminiCliProvider } from '@tmstaging/src/ai-providers/gemini-cli.js';
import { GrokCliProvider } from '@tmstaging/src/ai-providers/grok-cli.js';
import { AnthropicAIProvider } from '@tmstaging/src/ai-providers/anthropic.js';
import { OpenAIProvider } from '@tmstaging/src/ai-providers/openai.js';
import { GoogleAIProvider } from '@tmstaging/src/ai-providers/google.js';
import { PerplexityAIProvider } from '@tmstaging/src/ai-providers/perplexity.js';
import { XAIProvider } from '@tmstaging/src/ai-providers/xai.js';
import { GroqProvider } from '@tmstaging/src/ai-providers/groq.js';
import { OpenRouterAIProvider } from '@tmstaging/src/ai-providers/openrouter.js';
import { OllamaAIProvider } from '@tmstaging/src/ai-providers/ollama.js';
import { BedrockAIProvider } from '@tmstaging/src/ai-providers/bedrock.js';
import { AzureProvider } from '@tmstaging/src/ai-providers/azure.js';
import { VertexAIProvider } from '@tmstaging/src/ai-providers/google-vertex.js';

describe('Provider Temperature Support', () => {
	describe('CLI Providers', () => {
		it('should verify CLI providers have supportsTemperature = false', () => {
			expect(new ClaudeCodeProvider().supportsTemperature).toBe(false);
			expect(new CodexCliProvider().supportsTemperature).toBe(false);
			expect(new GeminiCliProvider().supportsTemperature).toBe(false);
			expect(new GrokCliProvider().supportsTemperature).toBe(false);
		});
	});

	describe('Standard API Providers', () => {
		it('should verify standard providers have supportsTemperature = true', () => {
			expect(new AnthropicAIProvider().supportsTemperature).toBe(true);
			expect(new OpenAIProvider().supportsTemperature).toBe(true);
			expect(new GoogleAIProvider().supportsTemperature).toBe(true);
			expect(new PerplexityAIProvider().supportsTemperature).toBe(true);
			expect(new XAIProvider().supportsTemperature).toBe(true);
			expect(new GroqProvider().supportsTemperature).toBe(true);
			expect(new OpenRouterAIProvider().supportsTemperature).toBe(true);
		});
	});

	describe('Special Case Providers', () => {
		it('should verify Ollama provider has supportsTemperature = true', () => {
			expect(new OllamaAIProvider().supportsTemperature).toBe(true);
		});

		it('should verify cloud providers have supportsTemperature = true', () => {
			expect(new BedrockAIProvider().supportsTemperature).toBe(true);
			expect(new AzureProvider().supportsTemperature).toBe(true);
			expect(new VertexAIProvider().supportsTemperature).toBe(true);
		});
	});
});
