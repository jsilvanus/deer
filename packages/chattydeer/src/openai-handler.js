import { randomUUID } from 'crypto';
import runAgentLoop from './agent-loop.js';

/**
 * Create an Express-compatible RequestHandler that implements a subset of
 * the OpenAI `POST /v1/chat/completions` contract and maps requests to the
 * internal ChatCompletionProvider + agent loop.
 *
 * @param {object} provider  ChatCompletionProvider (must implement complete())
 * @param {Array} tools      Optional tool definitions to expose to the model
 * @param {Function} executeTool async (name, args, callId) => string
 * @param {object} opts      { redactContent?: (text)=>string, maxRoundtrips?: number }
 * @returns {Function} Express RequestHandler (req, res, next)
 */
export function createOpenAiChatHandler(provider, tools = [], executeTool, opts = {}) {
  const { redactContent, maxRoundtrips = 5 } = opts;

  if (!provider || typeof provider.complete !== 'function') {
    throw new Error('provider with complete() is required');
  }

  return async function openAiHandler(req, res, next) {
    try {
      const body = req.body || {};
      const stream = !!body.stream;

      if (stream) {
        // Streaming deltas are not implemented in this lightweight handler.
        res.status(501).json({ error: 'streaming not supported' });
        return;
      }

      const model = body.model || 'unknown';
      const incomingMessages = Array.isArray(body.messages) ? body.messages : [];

      // Build a minimal session-like object for runAgentLoop
      const session = {
        _history: [],
        get history() { return [...this._history]; },
        append(msg) { this._history.push(msg); },
      };

      for (const m of incomingMessages) {
        const role = m.role || 'user';
        const content = String(m.content ?? '');
        const redacted = typeof redactContent === 'function' ? redactContent(content) : content;
        session.append({ role, content: redacted });
      }

      // Prefer functions/tools from the request, fall back to provided tools
      const reqTools = Array.isArray(body.functions) ? body.functions.map((f) => ({ name: f.name, description: f.description, parameters: f.parameters ?? {} })) : tools;

      const agentResult = await runAgentLoop(session, {
        provider,
        tools: reqTools,
        executeTool,
        maxRoundtrips,
        maxTokens: body.max_tokens ?? body.maxTokens,
        temperature: body.temperature,
        redactContent,
      });

      const answer = String(agentResult.answer ?? '');

      const response = {
        id: `chatcmpl-${randomUUID()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        choices: [{ index: 0, message: { role: 'assistant', content: answer }, finish_reason: 'stop' }],
      };

      res.json(response);
    } catch (err) {
      if (typeof next === 'function') return next(err);
      res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
  };
}

export default createOpenAiChatHandler;
