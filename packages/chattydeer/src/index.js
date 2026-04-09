/**
 * Public entry point for the chattydeer package.
 *
 * Provides LLM-based explanation, chat, and prompt utilities built on top of
 * @jsilvanus/embedeer's embedding infrastructure.
 *
 * @example
 * import { Explainer } from '@jsilvanus/chattydeer';
 *
 * const explainer = await Explainer.create('llama-3.2-3b', { deterministic: true });
 * const result = await explainer.explain({
 *   task: 'narrate',
 *   domain: 'evolution',
 *   context: { filePath: 'src/auth/handler.ts' },
 *   evidence: [
 *     { id: 1, source: 'src/auth/handler.ts', excerpt: '2024-03-15 *** LARGE CHANGE' },
 *   ],
 *   maxTokens: 256,
 * });
 * await explainer.destroy();
 *
 * @example
 * import { ChatSession } from '@jsilvanus/chattydeer';
 *
 * const session = await ChatSession.create('llama-3.2-3b', {
 *   systemPrompt: 'You are a gitsema guide assistant.',
 *   tools: [{ name: 'semantic_search', description: 'Search the codebase.', parameters: {} }],
 * });
 * const answer = await session.send('Which files handle auth?', {
 *   executeTool: async (name, args) => myTools[name](args),
 * });
 * await session.destroy();
 */

export { Explainer } from './explainer.js';
export { LLMAdapter } from './llm-adapter.js';
export { ChatSession } from './chat-session.js';
export { explainForGitsema } from './gitsema-adapter.js';
export { renderTemplate } from './explainer-templates.js';
export { estimateTokensFromChars, trimEvidenceForBudget } from './prompt-utils.js';
export { createChatProvider } from './chat-provider.js';
export { runAgentLoop } from './agent-loop.js';
export { createOpenAiChatHandler } from './openai-handler.js';
