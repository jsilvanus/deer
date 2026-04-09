import { randomUUID } from 'crypto';

function _extractMessagesFromSession(sessionLike) {
  if (!sessionLike) return [];
  if (Array.isArray(sessionLike.messages)) return sessionLike.messages;
  if (Array.isArray(sessionLike.history)) return sessionLike.history;
  if (typeof sessionLike.history === 'function') return sessionLike.history();
  if (Array.isArray(sessionLike._history)) return sessionLike._history;
  return [];
}

function _mapToOpenAiMessages(messages) {
  return messages.map((m) => {
    const role = m.role === 'tool' ? 'system' : m.role;
    const content = m.content ?? '';
    return { role, content };
  });
}

export function createChatProvider(httpUrl, model, apiKey) {
  const base = String(httpUrl || '').replace(/\/$/, '');
  const endpoint = base + '/v1/chat/completions';

  async function _doFetch(body, stream = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`chat provider HTTP ${res.status}: ${txt}`);
    }
    return res.json();
  }

  return {
    async complete(req = {}) {
      const tools = Array.isArray(req.tools) ? req.tools : [];
      const sessionLike = req.session;

      const srcMessages = _extractMessagesFromSession(sessionLike);
      const messages = _mapToOpenAiMessages(srcMessages);

      const functions = tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters ?? {} }));

      const body = {
        model,
        messages,
        temperature: typeof req.temperature === 'number' ? req.temperature : undefined,
        max_tokens: typeof req.maxTokens === 'number' ? req.maxTokens : undefined,
      };
      if (functions.length > 0) body.functions = functions;

      let json;
      try {
        json = await _doFetch(body, false);
      } catch (err) {
        return { message: { role: 'assistant', content: `Error: ${err.message}` }, tokensUsed: 0, finishReason: 'error' };
      }

      const choice = Array.isArray(json.choices) && json.choices[0] ? json.choices[0] : null;
      const usage = json.usage && typeof json.usage.total_tokens === 'number' ? json.usage.total_tokens : 0;

      if (!choice) {
        return { message: { role: 'assistant', content: '' }, tokensUsed: usage, finishReason: 'stop' };
      }

      const msg = choice.message ?? {};
      let content = String(msg.content ?? '');
      let toolCalls = null;

      // OpenAI-style function_call handling
      if (msg.function_call && msg.function_call.name) {
        const argsRaw = msg.function_call.arguments ?? '{}';
        let parsedArgs = {};
        try { parsedArgs = JSON.parse(argsRaw); } catch { parsedArgs = { raw: argsRaw }; }
        toolCalls = [{ id: randomUUID(), name: msg.function_call.name, arguments: parsedArgs }];
      } else {
        // Try to parse embedded JSON that may contain toolCalls
        try {
          const parsed = JSON.parse(content);
          if (parsed && Array.isArray(parsed.toolCalls)) toolCalls = parsed.toolCalls;
        } catch {
          // ignore
        }
      }

      const finishReason = choice.finish_reason ?? (toolCalls ? 'tool_calls' : 'stop');

      const responseMessage = { role: 'assistant', content };
      if (toolCalls) responseMessage.toolCalls = toolCalls;

      return { message: responseMessage, tokensUsed: usage, finishReason };
    },

    async *stream(req = {}) {
      const res = await this.complete(req);
      yield { delta: String(res.message.content ?? ''), done: true };
    },

    async destroy() {
      // no-op
    }
  };
}

export default createChatProvider;
