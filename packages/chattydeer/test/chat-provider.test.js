import { strict as assert } from 'assert';
import test from 'node:test';
import { createChatProvider } from '../dist/chat-provider.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal OpenAI-shaped completion response. */
function openAiBody(content, finishReason = 'stop', totalTokens = 20) {
  return {
    choices: [{ message: { role: 'assistant', content }, finish_reason: finishReason }],
    usage: { total_tokens: totalTokens },
  };
}

/** Returns a fetch mock that responds with the given JSON body. */
function stubFetch(responseBody, ok = true) {
  return async (_url, _opts) => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
  });
}

// ---------------------------------------------------------------------------
// Message extraction — session shape variants
// ---------------------------------------------------------------------------

test('complete() extracts messages from session.messages array', async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = stubFetch(openAiBody('Hello!'));
    const provider = createChatProvider('http://localhost:1234', 'test-model');
    const result = await provider.complete({ session: { messages: [{ role: 'user', content: 'Hi' }] } });
    assert.equal(result.message.content, 'Hello!');
    assert.equal(result.tokensUsed, 20);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() extracts messages from session.history array', async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = stubFetch(openAiBody('From history.'));
    const provider = createChatProvider('http://localhost:1234', 'test-model');
    const result = await provider.complete({ session: { history: [{ role: 'user', content: 'test' }] } });
    assert.equal(result.message.content, 'From history.');
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() extracts messages from session._history', async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = stubFetch(openAiBody('From _history.'));
    const provider = createChatProvider('http://localhost:1234', 'test-model');
    const result = await provider.complete({ session: { _history: [{ role: 'user', content: 'test' }] } });
    assert.equal(result.message.content, 'From _history.');
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() extracts messages from session.history() function', async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = stubFetch(openAiBody('From fn.'));
    const provider = createChatProvider('http://localhost:1234', 'test-model');
    const session = { history: () => [{ role: 'user', content: 'fn test' }] };
    const result = await provider.complete({ session });
    assert.equal(result.message.content, 'From fn.');
  } finally {
    globalThis.fetch = savedFetch;
  }
});

// ---------------------------------------------------------------------------
// Message role mapping
// ---------------------------------------------------------------------------

test('complete() maps "tool" role messages to role:"tool" with tool_call_id', async () => {
  const savedFetch = globalThis.fetch;
  let sentBody;
  try {
    globalThis.fetch = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => openAiBody('ok') };
    };
    const provider = createChatProvider('http://localhost:1234', 'model');
    await provider.complete({ session: { messages: [{ role: 'tool', content: 'tool result', toolCallId: 'call_1' }] } });
    assert.equal(sentBody.messages[0].role, 'tool');
    assert.equal(sentBody.messages[0].tool_call_id, 'call_1');
    assert.equal(sentBody.messages[0].content, 'tool result');
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() maps assistant toolCalls to tool_calls with stringified arguments', async () => {
  const savedFetch = globalThis.fetch;
  let sentBody;
  try {
    globalThis.fetch = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => openAiBody('ok') };
    };
    const provider = createChatProvider('http://localhost:1234', 'model');
    await provider.complete({
      session: {
        messages: [
          { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'search', arguments: { q: 'foo' } }] },
        ],
      },
    });
    assert.equal(sentBody.messages[0].tool_calls[0].id, 'call_1');
    assert.equal(sentBody.messages[0].tool_calls[0].type, 'function');
    assert.equal(sentBody.messages[0].tool_calls[0].function.name, 'search');
    assert.equal(sentBody.messages[0].tool_calls[0].function.arguments, JSON.stringify({ q: 'foo' }));
  } finally {
    globalThis.fetch = savedFetch;
  }
});

// ---------------------------------------------------------------------------
// Tool call parsing
// ---------------------------------------------------------------------------

test('complete() parses function_call from response into toolCalls', async () => {
  const savedFetch = globalThis.fetch;
  try {
    const response = {
      choices: [{
        message: { role: 'assistant', content: null, function_call: { name: 'search', arguments: '{"q":"foo"}' } },
        finish_reason: 'function_call',
      }],
      usage: { total_tokens: 15 },
    };
    globalThis.fetch = stubFetch(response);
    const provider = createChatProvider('http://localhost:1234', 'model');
    const result = await provider.complete({ session: { messages: [] } });
    assert.ok(Array.isArray(result.message.toolCalls));
    assert.equal(result.message.toolCalls[0].name, 'search');
    assert.deepEqual(result.message.toolCalls[0].arguments, { q: 'foo' });
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() parses JSON toolCalls from assistant content', async () => {
  const savedFetch = globalThis.fetch;
  try {
    const content = JSON.stringify({ toolCalls: [{ id: 'x', name: 'lookup', arguments: { id: 5 } }] });
    globalThis.fetch = stubFetch(openAiBody(content));
    const provider = createChatProvider('http://localhost:1234', 'model');
    const result = await provider.complete({ session: { messages: [] } });
    assert.ok(Array.isArray(result.message.toolCalls));
    assert.equal(result.message.toolCalls[0].name, 'lookup');
    assert.deepEqual(result.message.toolCalls[0].arguments, { id: 5 });
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() assigns a unique id when parsing function_call', async () => {
  const savedFetch = globalThis.fetch;
  try {
    const response = {
      choices: [{
        message: { role: 'assistant', content: null, function_call: { name: 'tool', arguments: '{}' } },
        finish_reason: 'function_call',
      }],
      usage: { total_tokens: 0 },
    };
    globalThis.fetch = stubFetch(response);
    const provider = createChatProvider('http://localhost:1234', 'model');
    const result = await provider.complete({ session: { messages: [] } });
    assert.ok(typeof result.message.toolCalls[0].id === 'string');
    assert.ok(result.message.toolCalls[0].id.length > 0);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

// ---------------------------------------------------------------------------
// HTTP error handling
// ---------------------------------------------------------------------------

test('complete() returns error message on HTTP failure', async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = stubFetch({ error: 'internal server error' }, false);
    const provider = createChatProvider('http://localhost:1234', 'model');
    const result = await provider.complete({ session: { messages: [] } });
    assert.equal(result.finishReason, 'error');
    assert.ok(result.message.content.startsWith('Error:'));
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() returns empty message when choices array is empty', async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = stubFetch({ choices: [], usage: { total_tokens: 0 } });
    const provider = createChatProvider('http://localhost:1234', 'model');
    const result = await provider.complete({ session: { messages: [] } });
    assert.equal(result.message.content, '');
    assert.equal(result.finishReason, 'stop');
  } finally {
    globalThis.fetch = savedFetch;
  }
});

// ---------------------------------------------------------------------------
// Request body construction
// ---------------------------------------------------------------------------

test('complete() includes tools in the request body in modern tool-calling shape when tools are provided', async () => {
  const savedFetch = globalThis.fetch;
  let sentBody;
  try {
    globalThis.fetch = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => openAiBody('ok') };
    };
    const provider = createChatProvider('http://localhost:1234', 'model');
    const tools = [{ name: 'lookup', description: 'Look it up', parameters: { type: 'object', properties: {} } }];
    await provider.complete({ session: { messages: [] }, tools });
    assert.ok(Array.isArray(sentBody.tools));
    assert.equal(sentBody.tools[0].type, 'function');
    assert.equal(sentBody.tools[0].function.name, 'lookup');
    assert.equal(sentBody.tools[0].function.description, 'Look it up');
    assert.ok(!('functions' in sentBody));
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() does not include tools key when no tools provided', async () => {
  const savedFetch = globalThis.fetch;
  let sentBody;
  try {
    globalThis.fetch = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => openAiBody('ok') };
    };
    const provider = createChatProvider('http://localhost:1234', 'model');
    await provider.complete({ session: { messages: [] } });
    assert.ok(!('tools' in sentBody));
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() includes Authorization header when apiKey is provided', async () => {
  const savedFetch = globalThis.fetch;
  let sentHeaders;
  try {
    globalThis.fetch = async (_url, opts) => {
      sentHeaders = opts.headers;
      return { ok: true, json: async () => openAiBody('ok') };
    };
    const provider = createChatProvider('http://localhost:1234', 'model', 'my-secret-key');
    await provider.complete({ session: { messages: [] } });
    assert.equal(sentHeaders['Authorization'], 'Bearer my-secret-key');
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() omits Authorization header when no apiKey', async () => {
  const savedFetch = globalThis.fetch;
  let sentHeaders;
  try {
    globalThis.fetch = async (_url, opts) => {
      sentHeaders = opts.headers;
      return { ok: true, json: async () => openAiBody('ok') };
    };
    const provider = createChatProvider('http://localhost:1234', 'model');
    await provider.complete({ session: { messages: [] } });
    assert.ok(!('Authorization' in sentHeaders));
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() strips trailing slash from base URL', async () => {
  const savedFetch = globalThis.fetch;
  let calledUrl;
  try {
    globalThis.fetch = async (url, _opts) => {
      calledUrl = url;
      return { ok: true, json: async () => openAiBody('ok') };
    };
    const provider = createChatProvider('http://localhost:1234/', 'model');
    await provider.complete({ session: { messages: [] } });
    assert.ok(calledUrl.endsWith('/v1/chat/completions'));
    assert.ok(!calledUrl.includes('//v1'));
  } finally {
    globalThis.fetch = savedFetch;
  }
});

// ---------------------------------------------------------------------------
// stream()
// ---------------------------------------------------------------------------

test('stream() yields a single delta chunk from complete()', async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = stubFetch(openAiBody('Stream content.'));
    const provider = createChatProvider('http://localhost:1234', 'model');
    const chunks = [];
    for await (const chunk of provider.stream({ session: { messages: [] } })) {
      chunks.push(chunk);
    }
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].delta, 'Stream content.');
    assert.equal(chunks[0].done, true);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('stream() yields SSE deltas in order with done=true last', async () => {
  const savedFetch = globalThis.fetch;
  try {
    const sseLines = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'lo' } }] })}`,
      'data: [DONE]',
      '',
    ].join('\n');

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: (k) => (k === 'content-type' ? 'text/event-stream' : null) },
      body: {
        getReader: () => {
          let sent = false;
          return {
            read: async () => {
              if (sent) return { done: true, value: undefined };
              sent = true;
              return { done: false, value: new TextEncoder().encode(sseLines) };
            },
            releaseLock: () => {},
          };
        },
      },
    });

    const provider = createChatProvider('http://localhost:1234', 'model');
    const chunks = [];
    for await (const chunk of provider.stream({ session: { messages: [] } })) {
      chunks.push(chunk);
    }
    assert.equal(chunks[0].delta, 'Hel');
    assert.equal(chunks[1].delta, 'lo');
    assert.equal(chunks[chunks.length - 1].done, true);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

// ---------------------------------------------------------------------------
// Timeout, retry, abort
// ---------------------------------------------------------------------------

test('complete() aborts and returns an error result on timeout', async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = (_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
    const provider = createChatProvider('http://localhost:1234', 'model', undefined, { timeoutMs: 10, maxRetries: 0 });
    const result = await provider.complete({ session: { messages: [] } });
    assert.equal(result.finishReason, 'error');
    assert.ok(result.message.content.includes('timed out'));
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() retries on HTTP 500 and succeeds', async () => {
  const savedFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) {
        return { ok: false, status: 500, text: async () => 'server error' };
      }
      return { ok: true, status: 200, json: async () => openAiBody('recovered') };
    };
    const provider = createChatProvider('http://localhost:1234', 'model', undefined, { maxRetries: 2 });
    const result = await provider.complete({ session: { messages: [] } });
    assert.equal(calls, 2);
    assert.equal(result.message.content, 'recovered');
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() gives up after exhausting retry budget on persistent 500s', async () => {
  const savedFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return { ok: false, status: 500, text: async () => 'still broken' };
    };
    const provider = createChatProvider('http://localhost:1234', 'model', undefined, { maxRetries: 1 });
    const result = await provider.complete({ session: { messages: [] } });
    assert.equal(calls, 2);
    assert.equal(result.finishReason, 'error');
    assert.ok(result.message.content.includes('500'));
  } finally {
    globalThis.fetch = savedFetch;
  }
});
