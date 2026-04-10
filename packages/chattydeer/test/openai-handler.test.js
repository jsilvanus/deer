import { strict as assert } from 'assert';
import test from 'node:test';
import { createOpenAiChatHandler } from '../dist/openai-handler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A provider that immediately returns a final answer with no tool calls. */
function makeFinalProvider(content = 'Mock answer.') {
  return {
    complete: async () => ({
      message: { role: 'assistant', content },
      tokensUsed: 5,
      finishReason: 'stop',
    }),
  };
}

/** Builds mock Express-style req/res objects. */
function makeReqRes(body = {}) {
  const res = {
    _body: null,
    _statusCode: null,
    status(code) { this._statusCode = code; return this; },
    json(data) { this._body = data; },
  };
  return { req: { body }, res };
}

// ---------------------------------------------------------------------------
// Constructor validation
// ---------------------------------------------------------------------------

test('createOpenAiChatHandler throws when provider is null', () => {
  assert.throws(
    () => createOpenAiChatHandler(null, [], async () => 'ok'),
    /provider with complete\(\) is required/,
  );
});

test('createOpenAiChatHandler throws when provider.complete is not a function', () => {
  assert.throws(
    () => createOpenAiChatHandler({ complete: 'nope' }, [], async () => 'ok'),
    /provider with complete\(\) is required/,
  );
});

// ---------------------------------------------------------------------------
// Streaming rejection
// ---------------------------------------------------------------------------

test('handler returns 501 for streaming requests', async () => {
  const handler = createOpenAiChatHandler(makeFinalProvider(), [], async () => 'ok');
  const { req, res } = makeReqRes({ stream: true, messages: [] });
  await handler(req, res, null);
  assert.equal(res._statusCode, 501);
  assert.ok(res._body.error);
});

// ---------------------------------------------------------------------------
// Successful response shape
// ---------------------------------------------------------------------------

test('handler returns a well-formed OpenAI chat completion object', async () => {
  const handler = createOpenAiChatHandler(makeFinalProvider('Hello world!'), [], async () => 'ok');
  const { req, res } = makeReqRes({ model: 'test-model', messages: [{ role: 'user', content: 'Hi' }] });
  await handler(req, res, null);

  const body = res._body;
  assert.equal(body.object, 'chat.completion');
  assert.ok(body.id.startsWith('chatcmpl-'));
  assert.ok(typeof body.created === 'number');
  assert.ok(Array.isArray(body.choices));
  assert.equal(body.choices[0].message.content, 'Hello world!');
  assert.equal(body.choices[0].message.role, 'assistant');
  assert.equal(body.choices[0].finish_reason, 'stop');
  assert.deepEqual(body.usage, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
});

test('handler echoes body.model in the response', async () => {
  const handler = createOpenAiChatHandler(makeFinalProvider(), [], async () => 'ok');
  const { req, res } = makeReqRes({ model: 'my-custom-model', messages: [] });
  await handler(req, res, null);
  assert.equal(res._body.model, 'my-custom-model');
});

test('handler uses "unknown" as model when body.model is absent', async () => {
  const handler = createOpenAiChatHandler(makeFinalProvider(), [], async () => 'ok');
  const { req, res } = makeReqRes({ messages: [] });
  await handler(req, res, null);
  assert.equal(res._body.model, 'unknown');
});

// ---------------------------------------------------------------------------
// Incoming message handling
// ---------------------------------------------------------------------------

test('handler builds session from incoming messages before calling the agent loop', async () => {
  let seenSession;
  const provider = {
    complete: async (req) => {
      seenSession = req.session;
      return { message: { role: 'assistant', content: 'ok' }, tokensUsed: 0, finishReason: 'stop' };
    },
  };
  const handler = createOpenAiChatHandler(provider, [], async () => 'ok');
  const { req, res } = makeReqRes({
    messages: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi there' },
    ],
  });
  await handler(req, res, null);
  const messages = seenSession.messages;
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[0].content, 'You are helpful.');
  assert.equal(messages[1].role, 'user');
  assert.equal(messages[1].content, 'Hi there');
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test('handler calls next() with the error when next is a function', async () => {
  const crashProvider = { complete: async () => { throw new Error('provider crashed'); } };
  const handler = createOpenAiChatHandler(crashProvider, [], async () => 'ok');
  const { req, res } = makeReqRes({ messages: [] });

  let nextError;
  await handler(req, res, (err) => { nextError = err; });
  assert.ok(nextError instanceof Error);
  assert.ok(nextError.message.includes('provider crashed'));
});

test('handler returns 500 JSON error when next is null', async () => {
  const crashProvider = { complete: async () => { throw new Error('server error'); } };
  const handler = createOpenAiChatHandler(crashProvider, [], async () => 'ok');
  const { req, res } = makeReqRes({ messages: [] });

  await handler(req, res, null);
  assert.equal(res._statusCode, 500);
  assert.ok(typeof res._body.error === 'string');
  assert.ok(res._body.error.includes('server error'));
});

// ---------------------------------------------------------------------------
// body.functions override
// ---------------------------------------------------------------------------

test('handler uses body.functions as tools when present', async () => {
  let seenTools;
  const provider = {
    complete: async (req) => {
      seenTools = req.tools;
      return { message: { role: 'assistant', content: 'done' }, tokensUsed: 0, finishReason: 'stop' };
    },
  };
  const handler = createOpenAiChatHandler(provider, [], async () => 'ok');
  const { req, res } = makeReqRes({
    messages: [],
    functions: [{ name: 'search', description: 'Search the web', parameters: {} }],
  });
  await handler(req, res, null);
  assert.ok(Array.isArray(seenTools));
  assert.equal(seenTools[0].name, 'search');
});

test('handler falls back to constructor tools when body.functions is absent', async () => {
  let seenTools;
  const provider = {
    complete: async (req) => {
      seenTools = req.tools;
      return { message: { role: 'assistant', content: 'done' }, tokensUsed: 0, finishReason: 'stop' };
    },
  };
  const ctorTools = [{ name: 'default_tool', description: 'A default tool' }];
  const handler = createOpenAiChatHandler(provider, ctorTools, async () => 'ok');
  const { req, res } = makeReqRes({ messages: [] });
  await handler(req, res, null);
  assert.ok(Array.isArray(seenTools));
  assert.equal(seenTools[0].name, 'default_tool');
});

// ---------------------------------------------------------------------------
// redactContent option
// ---------------------------------------------------------------------------

test('handler applies redactContent to incoming messages', async () => {
  let seenMessages;
  const provider = {
    complete: async (req) => {
      seenMessages = req.session.messages;
      return { message: { role: 'assistant', content: 'ok' }, tokensUsed: 0, finishReason: 'stop' };
    },
  };
  const handler = createOpenAiChatHandler(provider, [], async () => 'ok', {
    redactContent: (c) => c.replace('SECRET', '[REDACTED]'),
  });
  const { req, res } = makeReqRes({ messages: [{ role: 'user', content: 'My SECRET token' }] });
  await handler(req, res, null);
  assert.ok(seenMessages.some((m) => m.content.includes('[REDACTED]')));
  assert.ok(!seenMessages.some((m) => m.content.includes('SECRET')));
});
