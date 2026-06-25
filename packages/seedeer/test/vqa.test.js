import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RemoteVqaBackend } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAT_IMAGE = path.join(__dirname, 'fixtures', 'cats.jpg');

test('RemoteVqaBackend.create requires endpoint and model', async () => {
  await assert.rejects(() => RemoteVqaBackend.create({ model: 'qwen2-vl' }), /endpoint/);
  await assert.rejects(() => RemoteVqaBackend.create({ endpoint: 'http://localhost:11434/v1' }), /model/);
});

test('RemoteVqaBackend.ask posts an OpenAI-compatible chat completion and returns the answer', async (t) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: ' the door is open ' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const backend = await RemoteVqaBackend.create({
    endpoint: 'http://localhost:11434/v1',
    model: 'qwen2-vl',
    apiKey: 'secret',
  });
  const answer = await backend.ask(CAT_IMAGE, 'Is the door open?');

  assert.equal(answer, 'the door is open');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:11434/v1/chat/completions');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, 'qwen2-vl');
  assert.equal(body.messages[0].content[0].text, 'Is the door open?');
  assert.ok(body.messages[0].content[1].image_url.url.startsWith('data:image/jpeg;base64,'));

  await backend.destroy();
});

test('RemoteVqaBackend.ask surfaces a clear error when the endpoint is unreachable', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('connect ECONNREFUSED');
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const backend = await RemoteVqaBackend.create({
    endpoint: 'http://localhost:11434/v1',
    model: 'qwen2-vl',
  });
  await assert.rejects(() => backend.ask(CAT_IMAGE, 'Is the door open?'), /failed to reach endpoint/);
});

test('RemoteVqaBackend.ask surfaces a clear error on a non-2xx response', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('server exploded', { status: 500 });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const backend = await RemoteVqaBackend.create({
    endpoint: 'http://localhost:11434/v1',
    model: 'qwen2-vl',
  });
  await assert.rejects(() => backend.ask(CAT_IMAGE, 'Is the door open?'), /responded with 500/);
});
