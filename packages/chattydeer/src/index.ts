/**
 * Public entry point for the chattydeer package.
 */

export { Explainer } from './explainer.js';
export { LLMAdapter } from './llm-adapter.js';
export { ChatSession } from './chat-session.js';
// explainFromPayload is the canonical generic export; explainForGitsema is a
// backward-compatible alias kept for existing callers.
export { explainFromPayload, explainForGitsema } from './gitsema-adapter.js';
export { renderTemplate } from './explainer-templates.js';
export { estimateTokensFromChars, trimEvidenceForBudget } from './prompt-utils.js';
export { createChatProvider } from './chat-provider.js';
export { runAgentLoop } from './agent-loop.js';
export { createOpenAiChatHandler } from './openai-handler.js';
