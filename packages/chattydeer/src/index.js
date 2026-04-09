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
 */

export { Explainer } from './explainer.js';
export { LLMAdapter } from './llm-adapter.js';
export { explainForGitsema } from './gitsema-adapter.js';
export { renderTemplate } from './explainer-templates.js';
export { estimateTokensFromChars, trimEvidenceForBudget } from './prompt-utils.js';
