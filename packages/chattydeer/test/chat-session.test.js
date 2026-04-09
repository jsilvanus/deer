import { strict as assert } from 'assert';
import test from 'node:test';
import { ChatSession } from '../dist/chat-session.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock LLMAdapter whose generate() returns a fixed sequence of texts.
 * Throws if called more times than texts are provided. */
function makeMockAdapter(...texts) {
  let call = 0;
  return {
    modelName: 'mock',
    generate: async (_prompt, _opts) => {
      if (call >= texts.length) {
        throw new Error(`mock adapter exhausted after ${texts.length} call(s)`);
      }
      return { text: texts[call++], raw: null };
    },
  };
}

// ---------------------------------------------------------------------------
// Constructor validation
// ---------------------------------------------------------------------------

test('ChatSession constructor throws when adapter is missing generate', () => {
  assert.throws(() => new ChatSession({}), /adapter must implement generate/);
  assert.throws(() => new ChatSession(null), /adapter must implement generate/);
});

// ---------------------------------------------------------------------------
// Initial history
// ---------------------------------------------------------------------------

test('ChatSession history starts with system message when systemPrompt provided', () => {
  const adapter = makeMockAdapter('hello');
  const session = new ChatSession(adapter, { systemPrompt: 'You are a guide.' });
  const history = session.history;
  assert.equal(history.length, 1);
  assert.equal(history[0].role, 'system');
  assert.equal(history[0].content, 'You are a guide.');
});

test('ChatSession history starts empty when no systemPrompt', () => {
  const adapter = makeMockAdapter('hello');
  const session = new ChatSession(adapter, {});
  assert.equal(session.history.length, 0);
});

// ---------------------------------------------------------------------------
// Simple final-answer turn (no tool calls)
// ---------------------------------------------------------------------------

test('send() returns plain-text answer and appends messages to history', async () => {
  const adapter = makeMockAdapter('The auth module is in src/auth.');
  const session = new ChatSession(adapter);

  const answer = await session.send('Where is auth?');

  assert.equal(answer, 'The auth module is in src/auth.');

  const history = session.history;
  assert.equal(history.length, 2);
  assert.equal(history[0].role, 'user');
  assert.equal(history[0].content, 'Where is auth?');
  assert.equal(history[1].role, 'assistant');
  assert.equal(history[1].content, 'The auth module is in src/auth.');
});

// ---------------------------------------------------------------------------
// Tool-call detection and execution
// ---------------------------------------------------------------------------

test('send() detects pure JSON tool-call response and executes the tool', async () => {
  const toolCallJson = JSON.stringify({
    toolCalls: [{ id: 'c1', name: 'semantic_search', arguments: { query: 'auth' } }],
  });
  // First response: tool call; second response: final answer
  const adapter = makeMockAdapter(toolCallJson, 'Files: src/auth/handler.ts');

  let executedName, executedArgs;
  const executeTool = async (name, args) => {
    executedName = name;
    executedArgs = args;
    return 'src/auth/handler.ts (score=0.92)';
  };

  const session = new ChatSession(adapter, { tools: [{ name: 'semantic_search', description: 'Search' }] });
  const answer = await session.send('Which files handle auth?', { executeTool });

  assert.equal(executedName, 'semantic_search');
  assert.deepEqual(executedArgs, { query: 'auth' });
  assert.equal(answer, 'Files: src/auth/handler.ts');

  const history = session.history;
  // user → assistant(toolCalls) → tool → assistant(final)
  assert.equal(history.length, 4);
  assert.equal(history[0].role, 'user');
  assert.equal(history[1].role, 'assistant');
  assert.ok(Array.isArray(history[1].toolCalls));
  assert.equal(history[1].toolCalls[0].name, 'semantic_search');
  assert.equal(history[2].role, 'tool');
  assert.equal(history[2].toolName, 'semantic_search');
  assert.equal(history[2].content, 'src/auth/handler.ts (score=0.92)');
  assert.equal(history[3].role, 'assistant');
});

test('send() extracts embedded JSON tool-call from mixed text', async () => {
  const mixed =
    'Sure! {"toolCalls":[{"id":"x","name":"recent_commits","arguments":{"n":5}}]} calling tool now.';
  const adapter = makeMockAdapter(mixed, 'Last 5 commits listed.');

  const toolResults = [];
  const executeTool = async (name, args) => {
    toolResults.push({ name, args });
    return 'commit1, commit2, commit3, commit4, commit5';
  };

  const session = new ChatSession(adapter);
  const answer = await session.send('Show recent commits', { executeTool });

  assert.equal(answer, 'Last 5 commits listed.');
  assert.equal(toolResults.length, 1);
  assert.equal(toolResults[0].name, 'recent_commits');
});

// ---------------------------------------------------------------------------
// Tool execution error handling
// ---------------------------------------------------------------------------

test('send() forwards tool execution errors as tool result messages', async () => {
  const toolCallJson = JSON.stringify({
    toolCalls: [{ id: 'e1', name: 'broken_tool', arguments: {} }],
  });
  const adapter = makeMockAdapter(toolCallJson, 'I could not get the data.');

  const executeTool = async () => { throw new Error('timeout'); };

  const session = new ChatSession(adapter);
  const answer = await session.send('Run the tool', { executeTool });

  assert.equal(answer, 'I could not get the data.');
  const toolMsg = session.history.find((m) => m.role === 'tool');
  assert.ok(toolMsg, 'expected a tool message');
  assert.ok(toolMsg.content.includes('timeout'), `expected "timeout" in: ${toolMsg.content}`);
});

// ---------------------------------------------------------------------------
// No executeTool provided — treat response as final answer
// ---------------------------------------------------------------------------

test('send() treats tool-call JSON as final answer when no executeTool provided', async () => {
  const toolCallJson = JSON.stringify({
    toolCalls: [{ id: 'x', name: 'semantic_search', arguments: { query: 'foo' } }],
  });
  const adapter = makeMockAdapter(toolCallJson);

  const session = new ChatSession(adapter);
  const answer = await session.send('Search for foo');

  assert.equal(answer, toolCallJson);
});

// ---------------------------------------------------------------------------
// Multi-turn: second send() continues the same session
// ---------------------------------------------------------------------------

test('second send() call continues conversation history', async () => {
  const adapter = makeMockAdapter('First answer.', 'Second answer.');
  const session = new ChatSession(adapter);

  await session.send('First question');
  await session.send('Second question');

  const history = session.history;
  assert.equal(history.length, 4);
  assert.equal(history[0].content, 'First question');
  assert.equal(history[1].content, 'First answer.');
  assert.equal(history[2].content, 'Second question');
  assert.equal(history[3].content, 'Second answer.');
});

// ---------------------------------------------------------------------------
// history() returns a snapshot (mutations don't affect internal state)
// ---------------------------------------------------------------------------

test('history getter returns a snapshot not the live array', async () => {
  const adapter = makeMockAdapter('ok');
  const session = new ChatSession(adapter);
  await session.send('hi');

  const snap = session.history;
  snap.push({ role: 'user', content: 'injected' });
  assert.equal(session.history.length, 2, 'internal history should be unaffected');
});

// ---------------------------------------------------------------------------
// maxIterations guard
// ---------------------------------------------------------------------------

test('send() throws after exceeding maxIterations', async () => {
  // Adapter always returns a tool call — never a final answer
  const toolCallJson = JSON.stringify({
    toolCalls: [{ id: 'loop', name: 'infinite', arguments: {} }],
  });
  // maxIterations: 3 means up to 3 LLM generate() calls; supply 3 identical responses
  const adapter = makeMockAdapter(toolCallJson, toolCallJson, toolCallJson);
  const executeTool = async () => 'result';

  const session = new ChatSession(adapter);

  await assert.rejects(
    () => session.send('loop forever', { executeTool, maxIterations: 3 }),
    /exceeded maximum iterations/,
  );
});

// ---------------------------------------------------------------------------
// ChatSession.create factory
// ---------------------------------------------------------------------------

test('ChatSession.create() accepts a pre-built adapter and returns a ChatSession', async () => {
  const fakeAdapter = { modelName: 'fake', generate: async () => ({ text: 'hi', raw: null }) };
  const session = await ChatSession.create('irrelevant', { adapter: fakeAdapter });
  assert.ok(session instanceof ChatSession);
  const answer = await session.send('hello');
  assert.equal(answer, 'hi');
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

test('ChatSession.destroy() forwards to adapter.destroy', async () => {
  let destroyed = false;
  const adapter = {
    generate: async () => ({ text: 'ok', raw: null }),
    destroy: async () => { destroyed = true; },
  };
  const session = new ChatSession(adapter);
  await session.destroy();
  assert.equal(destroyed, true);
});

test('ChatSession.destroy() is safe when adapter has no destroy method', async () => {
  const adapter = { generate: async () => ({ text: 'ok', raw: null }) };
  const session = new ChatSession(adapter);
  await session.destroy(); // should not throw
});
