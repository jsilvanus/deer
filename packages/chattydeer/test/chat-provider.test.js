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

test('complete() maps "tool" role to "system" in the outgoing request body', async () => {
  const savedFetch = globalThis.fetch;
  let sentBody;
  try {
    globalThis.fetch = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => openAiBody('ok') };
    };
    const provider = createChatProvider('http://localhost:1234', 'model');
    await provider.complete({ session: { messages: [{ role: 'tool', content: 'tool result' }] } });
    assert.equal(sentBody.messages[0].role, 'system');
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

test('complete() includes functions in the request body when tools are provided', async () => {
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
    assert.ok(Array.isArray(sentBody.functions));
    assert.equal(sentBody.functions[0].name, 'lookup');
    assert.equal(sentBody.functions[0].description, 'Look it up');
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('complete() does not include functions key when no tools provided', async () => {
  const savedFetch = globalThis.fetch;
  let sentBody;
  try {
    globalThis.fetch = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => openAiBody('ok') };
    };
    const provider = createChatProvider('http://localhost:1234', 'model');
    await provider.complete({ session: { messages: [] } });
    assert.ok(!('functions' in sentBody));
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
