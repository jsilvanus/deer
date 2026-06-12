import { randomUUID } from 'crypto';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 250;

function _extractMessagesFromSession(sessionLike: any) {
  if (!sessionLike) return [];
  if (Array.isArray(sessionLike.messages)) return sessionLike.messages;
  if (Array.isArray(sessionLike.history)) return sessionLike.history;
  if (typeof sessionLike.history === 'function') return sessionLike.history();
  if (Array.isArray(sessionLike._history)) return sessionLike._history;
  return [];
}

/**
 * Maps internal ChatMessage[] to the OpenAI chat-completions wire format:
 * - assistant toolCalls -> tool_calls with stringified JSON arguments
 * - role:'tool' results -> role:'tool' with tool_call_id
 */
function _mapToOpenAiMessages(messages: any[]) {
  return messages.map((m) => {
    if (m.role === 'assistant' && Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content ?? null,
        tool_calls: m.toolCalls.map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments ?? {}) },
        })),
      };
    }
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId ?? m.id, content: m.content ?? '' };
    }
    return { role: m.role, content: m.content ?? '' };
  });
}

function _sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CreateChatProviderOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export function createChatProvider(
  httpUrl: string | undefined,
  model: string,
  apiKey?: string,
  providerOpts: CreateChatProviderOptions = {},
) {
  const base = String(httpUrl || '').replace(/\/$/, '');
  const endpoint = base + '/v1/chat/completions';
  const timeoutMs = typeof providerOpts.timeoutMs === 'number' ? providerOpts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const maxRetries = typeof providerOpts.maxRetries === 'number' ? providerOpts.maxRetries : DEFAULT_MAX_RETRIES;

  async function _doFetch(body: any, signal?: AbortSignal): Promise<any> {
    const headers: any = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onExternalAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', onExternalAbort);
      }

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const txt = await res.text();
          const retryable = (res.status === 429 || res.status >= 500) && attempt < maxRetries;
          if (retryable) {
            await _sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
            continue;
          }
          const excerpt = txt.slice(0, 500);
          throw new Error(`chat provider HTTP ${res.status}: ${excerpt}`);
        }

        return res;
      } catch (err: any) {
        if (signal?.aborted) {
          throw new Error('chat provider request aborted');
        }
        if (err && err.name === 'AbortError') {
          throw new Error(`chat provider request timed out after ${timeoutMs}ms`);
        }
        throw err;
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  function _buildBody(req: any) {
    const tools = Array.isArray(req.tools) ? req.tools : [];
    const sessionLike = req.session;

    const srcMessages = _extractMessagesFromSession(sessionLike);
    const messages = _mapToOpenAiMessages(srcMessages);

    const functions = tools.map((t: any) => ({ name: t.name, description: t.description, parameters: t.parameters ?? {} }));

    const body: any = {
      model,
      messages,
      temperature: typeof req.temperature === 'number' ? req.temperature : undefined,
      max_tokens: typeof req.maxTokens === 'number' ? req.maxTokens : undefined,
    };
    if (functions.length > 0) body.functions = functions;
    return body;
  }

  function _parseChoice(json: any) {
    const choice = Array.isArray(json.choices) && json.choices[0] ? json.choices[0] : null;
    const usage = json.usage && typeof json.usage.total_tokens === 'number' ? json.usage.total_tokens : 0;

    if (!choice) {
      return { message: { role: 'assistant', content: '' }, tokensUsed: usage, finishReason: 'stop' };
    }

    const msg = choice.message ?? {};
    const content = String(msg.content ?? '');
    let toolCalls: any = null;

    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      toolCalls = msg.tool_calls.map((tc: any) => {
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments ?? '{}'); } catch { parsedArgs = { raw: tc.function?.arguments }; }
        return { id: tc.id ?? randomUUID(), name: tc.function?.name, arguments: parsedArgs };
      });
    } else if (msg.function_call && msg.function_call.name) {
      const argsRaw = msg.function_call.arguments ?? '{}';
      let parsedArgs: any = {};
      try { parsedArgs = JSON.parse(argsRaw); } catch { parsedArgs = { raw: argsRaw }; }
      toolCalls = [{ id: randomUUID(), name: msg.function_call.name, arguments: parsedArgs }];
    } else {
      try {
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.toolCalls)) toolCalls = parsed.toolCalls;
      } catch {
        // ignore
      }
    }

    const finishReason = choice.finish_reason === 'tool_calls' || choice.finish_reason === 'function_call'
      ? 'tool_calls'
      : (choice.finish_reason ?? (toolCalls ? 'tool_calls' : 'stop'));

    const responseMessage: any = { role: 'assistant', content };
    if (toolCalls) responseMessage.toolCalls = toolCalls;

    return { message: responseMessage, tokensUsed: usage, finishReason: toolCalls ? 'tool_calls' : finishReason };
  }

  return {
    async complete(req: any = {}) {
      const body = _buildBody(req);

      let res: Response;
      try {
        res = await _doFetch(body, req.signal);
      } catch (err: any) {
        return { message: { role: 'assistant', content: `Error: ${err.message}` }, tokensUsed: 0, finishReason: 'error' };
      }

      const json = await res.json();
      return _parseChoice(json);
    },

    async *stream(req: any = {}) {
      const body = { ..._buildBody(req), stream: true };

      let res: Response;
      try {
        res = await _doFetch(body, req.signal);
      } catch (err: any) {
        yield { delta: `Error: ${err.message}`, done: true };
        return;
      }

      const contentType = res.headers?.get?.('content-type') ?? '';
      if (!res.body || !contentType.includes('text/event-stream')) {
        const json = await res.json();
        const parsed = _parseChoice(json);
        yield { delta: String(parsed.message.content ?? ''), done: true };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (!line.startsWith('data:')) continue;

            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              yield { delta: '', done: true };
              return;
            }

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta?.content ?? '';
              if (delta) yield { delta, done: false };
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      } finally {
        reader.releaseLock?.();
      }

      yield { delta: '', done: true };
    },

    async destroy() {
      // no-op
    }
  };
}

export default createChatProvider;
