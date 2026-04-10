import { strict as assert } from 'assert';
import test from 'node:test';
import { LLMAdapter } from '../dist/llm-adapter.js';

// ---------------------------------------------------------------------------
// Constructor validation
// ---------------------------------------------------------------------------

test('LLMAdapter constructor throws when generateFn is not a function', () => {
  assert.throws(() => new LLMAdapter(null), /generateFn must be a function/);
  assert.throws(() => new LLMAdapter('not-a-fn'), /generateFn must be a function/);
  assert.throws(() => new LLMAdapter(42), /generateFn must be a function/);
});

test('LLMAdapter constructor stores modelName and deterministic flag', () => {
  const fn = async () => ({ text: 'ok', raw: null });
  const adapter = new LLMAdapter(fn, 'my-model', false);
  assert.equal(adapter.modelName, 'my-model');
  assert.equal(adapter.deterministic, false);
});

test('LLMAdapter constructor defaults modelName to "local" and deterministic to true', () => {
  const fn = async () => ({ text: 'ok', raw: null });
  const adapter = new LLMAdapter(fn);
  assert.equal(adapter.modelName, 'local');
  assert.equal(adapter.deterministic, true);
});

// ---------------------------------------------------------------------------
// generate() option mapping
// ---------------------------------------------------------------------------

test('LLMAdapter.generate() maps maxTokens to max_new_tokens', async () => {
  let capturedOpts;
  const fn = async (_prompt, opts) => { capturedOpts = opts; return { text: 'r', raw: null }; };
  const adapter = new LLMAdapter(fn, 'model');
  await adapter.generate('hello', { maxTokens: 128 });
  assert.equal(capturedOpts.max_new_tokens, 128);
});

test('LLMAdapter.generate() uses deterministic defaults when no options given', async () => {
  let capturedOpts;
  const fn = async (_prompt, opts) => { capturedOpts = opts; return { text: 'r', raw: null }; };
  const adapter = new LLMAdapter(fn, 'model');
  await adapter.generate('hello');
  assert.equal(capturedOpts.temperature, 0);
  assert.equal(capturedOpts.top_k, 1);
  assert.equal(capturedOpts.top_p, 1);
  assert.equal(capturedOpts.do_sample, false);
  assert.equal(capturedOpts.max_new_tokens, 256);
});

test('LLMAdapter.generate() passes extra options through to generateFn', async () => {
  let capturedOpts;
  const fn = async (_prompt, opts) => { capturedOpts = opts; return { text: 'r', raw: null }; };
  const adapter = new LLMAdapter(fn, 'model');
  await adapter.generate('hello', { maxTokens: 64, custom_flag: true });
  assert.equal(capturedOpts.custom_flag, true);
  assert.equal(capturedOpts.max_new_tokens, 64);
});

// ---------------------------------------------------------------------------
// generate() return shape
// ---------------------------------------------------------------------------

test('LLMAdapter.generate() returns { text, raw, meta } shape', async () => {
  const fn = async () => ({ text: 'hello world', raw: { someRaw: true } });
  const adapter = new LLMAdapter(fn, 'my-model');
  const result = await adapter.generate('prompt');
  assert.equal(result.text, 'hello world');
  assert.deepEqual(result.raw, { someRaw: true });
  assert.equal(result.meta.model, 'my-model');
});

test('LLMAdapter.generate() returns empty string text when generateFn returns no text', async () => {
  const fn = async () => ({ raw: null });
  const adapter = new LLMAdapter(fn, 'model');
  const result = await adapter.generate('prompt');
  assert.equal(result.text, '');
});

// ---------------------------------------------------------------------------
// create() factory with generateFn bypass
// ---------------------------------------------------------------------------

test('LLMAdapter.create() with generateFn option skips HF model loading', async () => {
  const mockFn = async () => ({ text: 'mocked output', raw: null });
  const adapter = await LLMAdapter.create('any-model-name', { generateFn: mockFn });
  assert.ok(adapter instanceof LLMAdapter);
  const result = await adapter.generate('test prompt');
  assert.equal(result.text, 'mocked output');
});

test('LLMAdapter.create() with generateFn stores the provided modelName', async () => {
  const mockFn = async () => ({ text: 'ok', raw: null });
  const adapter = await LLMAdapter.create('test-model-123', { generateFn: mockFn });
  assert.equal(adapter.modelName, 'test-model-123');
});

// ---------------------------------------------------------------------------
// destroy() — pipeline cleanup paths
// ---------------------------------------------------------------------------

test('LLMAdapter.destroy() cleans up _pipeline via cleanup() method', async () => {
  let cleanedUp = false;
  const fn = async () => ({ text: 'ok', raw: null });
  const adapter = new LLMAdapter(fn, 'model');
  adapter._pipeline = { cleanup: async () => { cleanedUp = true; } };
  await adapter.destroy();
  assert.equal(cleanedUp, true);
  assert.equal(adapter._pipeline, undefined);
});

test('LLMAdapter.destroy() cleans up _pipeline via destroy() when no cleanup()', async () => {
  let destroyed = false;
  const fn = async () => ({ text: 'ok', raw: null });
  const adapter = new LLMAdapter(fn, 'model');
  adapter._pipeline = { destroy: async () => { destroyed = true; } };
  await adapter.destroy();
  assert.equal(destroyed, true);
  assert.equal(adapter._pipeline, undefined);
});

test('LLMAdapter.destroy() clears _pool reference after destroying', async () => {
  const fn = async () => ({ text: 'ok', raw: null });
  const adapter = new LLMAdapter(fn, 'model');
  adapter._pool = { destroy: async () => {} };
  await adapter.destroy();
  assert.equal(adapter._pool, undefined);
});

test('LLMAdapter.destroy() is safe when neither pool nor pipeline is set', async () => {
  const fn = async () => ({ text: 'ok', raw: null });
  const adapter = new LLMAdapter(fn, 'model');
  await adapter.destroy(); // should not throw
});
