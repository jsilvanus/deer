import { strict as assert } from 'assert';
import test from 'node:test';
import { createAgentSession } from '../dist/agent-session.js';
import { runAgentLoop } from '../dist/agent-loop.js';

test('createAgentSession starts empty with no options', () => {
  const session = createAgentSession();
  assert.deepEqual(session.history, []);
});

test('createAgentSession seeds systemPrompt and initial messages', () => {
  const session = createAgentSession({
    systemPrompt: 'You are helpful.',
    messages: [{ role: 'user', content: 'hi' }],
  });
  assert.equal(session.history[0].role, 'user');
  assert.equal(session.history[0].content, 'hi');
  assert.equal(session.history[1].role, 'system');
  assert.equal(session.history[1].content, 'You are helpful.');
});

test('createAgentSession.append validates and stores messages', () => {
  const session = createAgentSession();
  assert.throws(() => session.append({}), /append requires a message with a role/);

  session.append({ role: 'assistant', content: 'hello', toolCalls: [{ id: '1', name: 'x', arguments: {} }] });
  const last = session.history[session.history.length - 1];
  assert.equal(last.role, 'assistant');
  assert.equal(last.content, 'hello');
  assert.deepEqual(last.toolCalls, [{ id: '1', name: 'x', arguments: {} }]);

  // history is a snapshot, not a live reference
  session.history.push({ role: 'user', content: 'mutate' });
  assert.equal(session.history.length, 1);
});

test('createAgentSession works as the session object for runAgentLoop', async () => {
  const session = createAgentSession({ messages: [{ role: 'user', content: 'hi' }] });
  const provider = {
    complete: async () => ({ message: { role: 'assistant', content: 'pong' }, tokensUsed: 1, finishReason: 'stop' }),
  };

  const result = await runAgentLoop(session, { provider, executeTool: async () => 'unused' });

  assert.equal(result.answer, 'pong');
  assert.equal(session.history[session.history.length - 1].content, 'pong');
});
