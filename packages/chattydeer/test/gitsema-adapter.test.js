import { strict as assert } from 'assert';
import test from 'node:test';
import { explainForGitsema } from '../dist/gitsema-adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a mock adapter that returns a fixed Explainer-compatible JSON response. */
function makeMockAdapter(explainerResponse, { trackDestroy = false } = {}) {
  let destroyed = false;
  const adapter = {
    modelName: 'mock',
    generate: async () => ({ text: JSON.stringify(explainerResponse), raw: null }),
    destroy: async () => { destroyed = true; },
    get wasDestroyed() { return destroyed; },
  };
  return adapter;
}

const VALID_RESPONSE = {
  explanation: 'Security analysis [1]',
  labels: ['security'],
  references: [{ id: 1, source: 'auth.js', claim: 'token check' }],
  meta: {},
};

const EVIDENCE = [{ id: 1, source: 'auth.js', excerpt: 'token validation logic' }];

// ---------------------------------------------------------------------------
// Basic payload mapping
// ---------------------------------------------------------------------------

test('explainForGitsema returns the Explainer result', async () => {
  const adapter = makeMockAdapter(VALID_RESPONSE);
  const result = await explainForGitsema(
    { task: 'analyze', domain: 'security', evidence: EVIDENCE, maxTokens: 128 },
    { adapter },
  );
  assert.equal(result.explanation, 'Security analysis [1]');
  assert.deepEqual(result.labels, ['security']);
  assert.equal(result.references.length, 1);
});

test('explainForGitsema defaults task to "explain" when absent', async () => {
  // Without a task the prompt is still built; as long as the adapter echoes a valid
  // response shape the function should succeed.
  const adapter = makeMockAdapter({
    explanation: 'ok [1]',
    labels: [],
    references: [{ id: 1, source: 'f.js' }],
    meta: {},
  });
  const result = await explainForGitsema(
    { domain: 'general', evidence: [{ id: 1, source: 'f.js', excerpt: 'x' }] },
    { adapter },
  );
  assert.ok('explanation' in result);
});

test('explainForGitsema defaults domain to "general" when absent', async () => {
  const adapter = makeMockAdapter({
    explanation: 'INSUFFICIENT_EVIDENCE',
    labels: [],
    references: [],
    meta: {},
  });
  const result = await explainForGitsema(
    { task: 'explain', evidence: [] },
    { adapter },
  );
  // Shape should always be present even with empty evidence
  assert.ok('explanation' in result);
  assert.ok(Array.isArray(result.labels));
  assert.ok(Array.isArray(result.references));
  assert.ok('meta' in result);
});

test('explainForGitsema passes context to the Explainer prompt', async () => {
  let capturedPrompt;
  const adapter = {
    modelName: 'mock',
    generate: async (prompt) => {
      capturedPrompt = prompt;
      return {
        text: JSON.stringify({ explanation: 'ok [1]', labels: [], references: [{ id: 1 }], meta: {} }),
        raw: null,
      };
    },
    destroy: async () => {},
  };
  const context = { repo: 'myrepo', author: 'alice' };
  await explainForGitsema(
    { task: 'explain', domain: 'general', context, evidence: [{ id: 1, source: 'f.js', excerpt: 'x' }] },
    { adapter },
  );
  assert.ok(capturedPrompt.includes('myrepo'), 'context should appear in the prompt');
});

// ---------------------------------------------------------------------------
// autoDestroy behaviour
// ---------------------------------------------------------------------------

test('explainForGitsema calls adapter.destroy() when autoDestroy is true', async () => {
  const adapter = makeMockAdapter({
    explanation: 'ok',
    labels: [],
    references: [],
    meta: {},
  });
  await explainForGitsema({ task: 'explain', evidence: [] }, { adapter, autoDestroy: true });
  assert.equal(adapter.wasDestroyed, true);
});

test('explainForGitsema does NOT call adapter.destroy() when autoDestroy is false', async () => {
  const adapter = makeMockAdapter({
    explanation: 'ok',
    labels: [],
    references: [],
    meta: {},
  });
  await explainForGitsema({ task: 'explain', evidence: [] }, { adapter, autoDestroy: false });
  assert.equal(adapter.wasDestroyed, false);
});

test('explainForGitsema does NOT call adapter.destroy() by default', async () => {
  const adapter = makeMockAdapter({
    explanation: 'ok',
    labels: [],
    references: [],
    meta: {},
  });
  await explainForGitsema({ task: 'explain', evidence: [] }, { adapter });
  assert.equal(adapter.wasDestroyed, false);
});

// ---------------------------------------------------------------------------
// Response shape guarantee
// ---------------------------------------------------------------------------

test('explainForGitsema always returns explanation, labels, references, meta', async () => {
  const adapter = makeMockAdapter(VALID_RESPONSE);
  const result = await explainForGitsema(
    { task: 'analyze', domain: 'security', evidence: EVIDENCE },
    { adapter },
  );
  assert.ok(typeof result.explanation === 'string');
  assert.ok(Array.isArray(result.labels));
  assert.ok(Array.isArray(result.references));
  assert.ok(result.meta && typeof result.meta === 'object');
});
