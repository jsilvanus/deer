import { strict as assert } from 'assert';
import test from 'node:test';
import { runAgentLoop } from '../dist/agent-loop.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal session object compatible with runAgentLoop. */
function makeSession(messages = []) {
  const _history = [...messages];
  return {
    get history() { return [..._history]; },
    append(msg) { _history.push({ ...msg }); },
  };
}

/** Provider that always returns a plain final answer (no tool calls). */
function makeFinalProvider(content = 'Final answer.') {
  return {
    complete: async () => ({
      message: { role: 'assistant', content },
      tokensUsed: 10,
      finishReason: 'stop',
    }),
  };
}

/** Provider that returns one round of tool calls, then a final answer. */
function makeToolThenFinalProvider(toolCalls, finalContent = 'Done.') {
  let call = 0;
  return {
    complete: async () => {
      if (call++ === 0) {
        return { message: { role: 'assistant', content: '', toolCalls }, tokensUsed: 0, finishReason: 'tool_calls' };
      }
      return { message: { role: 'assistant', content: finalContent }, tokensUsed: 5, finishReason: 'stop' };
    },
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test('runAgentLoop throws when provider is missing', async () => {
  const session = makeSession();
  await assert.rejects(
    () => runAgentLoop(session, { executeTool: async () => 'r' }),
    /provider with complete\(\) required/,
  );
});

test('runAgentLoop throws when provider.complete is not a function', async () => {
  const session = makeSession();
  await assert.rejects(
    () => runAgentLoop(session, { provider: { complete: 'nope' }, executeTool: async () => 'r' }),
    /provider with complete\(\) required/,
  );
});

test('runAgentLoop throws when executeTool is missing', async () => {
  const session = makeSession();
  await assert.rejects(
    () => runAgentLoop(session, { provider: makeFinalProvider() }),
    /executeTool callback required/,
  );
});

// ---------------------------------------------------------------------------
// Immediate final answer (no tool calls)
// ---------------------------------------------------------------------------

test('runAgentLoop returns final answer when provider returns no tool calls', async () => {
  const session = makeSession([{ role: 'user', content: 'Hello' }]);
  const result = await runAgentLoop(session, {
    provider: makeFinalProvider('The answer is 42.'),
    executeTool: async () => 'unused',
  });
  assert.equal(result.answer, 'The answer is 42.');
  assert.equal(result.roundtrips, 0);
});

test('runAgentLoop appends final assistant message to session history', async () => {
  const session = makeSession([{ role: 'user', content: 'Hi' }]);
  await runAgentLoop(session, {
    provider: makeFinalProvider('Hello back!'),
    executeTool: async () => 'unused',
  });
  const history = session.history;
  const last = history[history.length - 1];
  assert.equal(last.role, 'assistant');
  assert.equal(last.content, 'Hello back!');
});

test('runAgentLoop returns { answer, messages, roundtrips } shape', async () => {
  const session = makeSession([{ role: 'user', content: 'ping' }]);
  const result = await runAgentLoop(session, {
    provider: makeFinalProvider('pong'),
    executeTool: async () => 'unused',
  });
  assert.ok('answer' in result);
  assert.ok('messages' in result);
  assert.ok('roundtrips' in result);
  assert.equal(typeof result.roundtrips, 'number');
});

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

test('runAgentLoop executes tool and continues to final answer', async () => {
  const toolCalls = [{ id: 'c1', name: 'search', arguments: { q: 'foo' } }];
  const provider = makeToolThenFinalProvider(toolCalls, 'Search complete.');
  const session = makeSession([{ role: 'user', content: 'Search foo' }]);

  let toolCalled = false;
  const executeTool = async (name, args) => {
    toolCalled = true;
    assert.equal(name, 'search');
    assert.deepEqual(args, { q: 'foo' });
    return 'result: bar';
  };

  const result = await runAgentLoop(session, { provider, executeTool });
  assert.equal(toolCalled, true);
  assert.equal(result.answer, 'Search complete.');
  assert.equal(result.roundtrips, 1);
});

test('runAgentLoop appends tool result message to session history', async () => {
  const toolCalls = [{ id: 't1', name: 'lookup', arguments: {} }];
  const provider = makeToolThenFinalProvider(toolCalls, 'Done.');
  const session = makeSession([{ role: 'user', content: 'lookup' }]);

  await runAgentLoop(session, {
    provider,
    executeTool: async () => 'lookup result',
  });

  const toolMsg = session.history.find((m) => m.role === 'tool');
  assert.ok(toolMsg, 'expected a tool message in history');
  assert.equal(toolMsg.toolName, 'lookup');
  assert.equal(toolMsg.content, 'lookup result');
});

test('runAgentLoop forwards tool execution errors as tool result messages (no throw)', async () => {
  const toolCalls = [{ id: 'e1', name: 'bad_tool', arguments: {} }];
  const provider = makeToolThenFinalProvider(toolCalls, 'Sorry, failed.');
  const session = makeSession([{ role: 'user', content: 'use bad tool' }]);

  const result = await runAgentLoop(session, {
    provider,
    executeTool: async () => { throw new Error('network timeout'); },
  });

  assert.equal(result.answer, 'Sorry, failed.');
  const toolMsg = session.history.find((m) => m.role === 'tool');
  assert.ok(toolMsg);
  assert.ok(toolMsg.content.includes('network timeout'));
});

// ---------------------------------------------------------------------------
// maxRoundtrips guard
// ---------------------------------------------------------------------------

test('runAgentLoop throws when maxRoundtrips is exceeded', async () => {
  const toolCalls = [{ id: 'l1', name: 'loop', arguments: {} }];
  const infiniteProvider = {
    complete: async () => ({
      message: { role: 'assistant', content: '', toolCalls },
      tokensUsed: 0,
      finishReason: 'tool_calls',
    }),
  };
  const session = makeSession([{ role: 'user', content: 'loop forever' }]);

  await assert.rejects(
    () => runAgentLoop(session, {
      provider: infiniteProvider,
      executeTool: async () => 'ok',
      maxRoundtrips: 2,
    }),
    /exceeded maxRoundtrips/,
  );
});

// ---------------------------------------------------------------------------
// onMessage callback
// ---------------------------------------------------------------------------

test('runAgentLoop fires onMessage for assistant tool-call, tool result, and final answer', async () => {
  const toolCalls = [{ id: 'm1', name: 'fetch_data', arguments: {} }];
  const provider = makeToolThenFinalProvider(toolCalls, 'Final.');
  const session = makeSession([{ role: 'user', content: 'go' }]);
  const messages = [];

  await runAgentLoop(session, {
    provider,
    executeTool: async () => 'tool output',
    onMessage: (msg) => messages.push(msg),
  });

  // Expect: assistant(toolCalls) + tool + assistant(final)
  assert.ok(messages.length >= 3, `expected >= 3 messages, got ${messages.length}`);
  assert.ok(messages.some((m) => m.role === 'tool' && m.toolName === 'fetch_data'));
  assert.ok(messages.some((m) => m.role === 'assistant' && m.content === 'Final.'));
});

test('runAgentLoop fires onMessage for final answer even with no tool calls', async () => {
  const session = makeSession([{ role: 'user', content: 'hi' }]);
  const messages = [];

  await runAgentLoop(session, {
    provider: makeFinalProvider('pong'),
    executeTool: async () => 'unused',
    onMessage: (msg) => messages.push(msg),
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].role, 'assistant');
  assert.equal(messages[0].content, 'pong');
});

// ---------------------------------------------------------------------------
// redactContent
// ---------------------------------------------------------------------------

test('runAgentLoop applies redactContent before sending messages to provider', async () => {
  const session = makeSession([{ role: 'user', content: 'My SECRET_TOKEN is here' }]);
  let seenMessages;
  const provider = {
    complete: async (req) => {
      seenMessages = req.session.messages;
      return { message: { role: 'assistant', content: 'ok' }, tokensUsed: 0, finishReason: 'stop' };
    },
  };

  await runAgentLoop(session, {
    provider,
    executeTool: async () => 'unused',
    redactContent: (content) => content.replace('SECRET_TOKEN', '[REDACTED]'),
  });

  assert.ok(seenMessages.some((m) => m.content.includes('[REDACTED]')));
  assert.ok(!seenMessages.some((m) => m.content.includes('SECRET_TOKEN')));
});
