import { strict as assert } from 'assert';
import test from 'node:test';
import { Explainer } from '../dist/explainer.js';

test('parses valid JSON output from adapter', async () => {
  const mockAdapter = {
    generate: async (prompt, opts) => {
      return { text: JSON.stringify({
        explanation: 'Test explanation [1]',
        labels: [],
        references: [{ id: 1, source: 'src/foo.js', claim: 'rewrite' }],
        meta: {}
      }) };
    }
  };

  const expl = new Explainer(mockAdapter, { deterministic: true });

  const req = {
    task: 'narrate',
    domain: 'evolution',
    context: {},
    evidence: [{ id: 1, source: 'src/foo.js', excerpt: 'foo changed' }],
    maxTokens: 128,
  };

  const res = await expl.explain(req);
  assert.equal(res.explanation, 'Test explanation [1]');
  assert.equal(res.references.length, 1);
  assert.equal(res.labels.length, 0);
});

test('repairs non-JSON output by asking adapter to return JSON', async () => {
  let calls = 0;
  const mockAdapter = {
    generate: async (prompt, opts) => {
      calls++;
      if (calls === 1) {
        return { text: 'Note: summary follows\nNO JSON HERE' };
      }
      // repair call
      return { text: JSON.stringify({
        explanation: 'Repaired [1]',
        labels: [],
        references: [{ id: 1, source: 'src/foo.js' }],
        meta: {}
      }) };
    }
  };

  const expl = new Explainer(mockAdapter, { deterministic: true });
  const req = {
    task: 'narrate',
    domain: 'evolution',
    context: {},
    evidence: [{ id: 1, source: 'src/foo.js', excerpt: 'foo changed' }],
    maxTokens: 128,
  };

  const res = await expl.explain(req);
  assert.equal(res.explanation, 'Repaired [1]');
});

test('invalid citations produce INSUFFICIENT_EVIDENCE', async () => {
  const mockAdapter = {
    generate: async (prompt, opts) => {
      return { text: JSON.stringify({
        explanation: 'Claim [99]',
        labels: [],
        references: [{ id: 99, source: 'unknown' }],
        meta: {}
      }) };
    }
  };

  const expl = new Explainer(mockAdapter, { deterministic: true });
  const req = {
    task: 'narrate',
    domain: 'evolution',
    context: {},
    evidence: [{ id: 1, source: 'src/foo.js', excerpt: 'foo changed' }],
    maxTokens: 128,
  };

  const res = await expl.explain(req);
  assert.equal(res.explanation, 'INSUFFICIENT_EVIDENCE');
});

// ---------------------------------------------------------------------------
// Constructor validation
// ---------------------------------------------------------------------------

test('Explainer constructor throws when adapter is null', () => {
  assert.throws(() => new Explainer(null), /adapter must implement generate/);
});

test('Explainer constructor throws when adapter has no generate method', () => {
  assert.throws(() => new Explainer({ notGenerate: () => {} }), /adapter must implement generate/);
});

// ---------------------------------------------------------------------------
// create() factory
// ---------------------------------------------------------------------------

test('Explainer.create() accepts a pre-built adapter and returns an Explainer', async () => {
  const mockAdapter = {
    modelName: 'mock',
    generate: async () => ({
      text: JSON.stringify({
        explanation: 'from factory [1]',
        labels: ['test'],
        references: [{ id: 1, source: 'f.js' }],
        meta: {},
      }),
    }),
  };
  const expl = await Explainer.create('any-model', { adapter: mockAdapter });
  assert.ok(expl instanceof Explainer);
  const res = await expl.explain({
    task: 'test',
    domain: 'general',
    evidence: [{ id: 1, source: 'f.js', excerpt: 'x' }],
  });
  assert.equal(res.explanation, 'from factory [1]');
});

// ---------------------------------------------------------------------------
// buildPrompt() content
// ---------------------------------------------------------------------------

test('buildPrompt() includes task, domain, and evidence excerpt', () => {
  const expl = new Explainer({ generate: async () => ({ text: '{}' }) });
  const prompt = expl.buildPrompt({
    task: 'analyze auth flow',
    domain: 'security',
    context: {},
    evidence: [{ id: 1, source: 'auth.js', excerpt: 'token validation logic' }],
  });
  assert.ok(prompt.includes('analyze auth flow'), 'prompt should include task');
  assert.ok(prompt.includes('security'), 'prompt should include domain');
  assert.ok(prompt.includes('token validation logic'), 'prompt should include evidence excerpt');
});

// ---------------------------------------------------------------------------
// Exhausted repair path → INSUFFICIENT_EVIDENCE
// ---------------------------------------------------------------------------

test('explain() returns INSUFFICIENT_EVIDENCE when both generate attempts return invalid JSON', async () => {
  // Both the initial call and the repair call return un-parseable text.
  const mockAdapter = {
    modelName: 'mock',
    generate: async () => ({ text: 'NOT JSON AT ALL' }),
  };
  const expl = new Explainer(mockAdapter, { deterministic: true });
  const res = await expl.explain({
    task: 'test',
    domain: 'general',
    context: {},
    evidence: [{ id: 1, source: 'f.js', excerpt: 'x' }],
  });
  assert.equal(res.explanation, 'INSUFFICIENT_EVIDENCE');
  assert.deepEqual(res.labels, []);
  assert.deepEqual(res.references, []);
});

// ---------------------------------------------------------------------------
// Empty evidence
// ---------------------------------------------------------------------------

test('explain() with empty evidence always returns a valid response shape', async () => {
  const mockAdapter = {
    modelName: 'mock',
    generate: async () => ({
      text: JSON.stringify({ explanation: 'INSUFFICIENT_EVIDENCE', labels: [], references: [], meta: {} }),
    }),
  };
  const expl = new Explainer(mockAdapter);
  const res = await expl.explain({ task: 'test', domain: 'general', evidence: [] });
  assert.ok('explanation' in res);
  assert.ok('labels' in res);
  assert.ok('references' in res);
  assert.ok('meta' in res);
});

// ---------------------------------------------------------------------------
// Non-deterministic mode
// ---------------------------------------------------------------------------

test('explain() in non-deterministic mode does not force temperature or sampling params', async () => {
  let capturedOpts;
  const mockAdapter = {
    modelName: 'mock',
    generate: async (_prompt, opts) => {
      capturedOpts = opts;
      return { text: JSON.stringify({ explanation: 'ok', labels: [], references: [], meta: {} }) };
    },
  };
  const expl = new Explainer(mockAdapter, { deterministic: false });
  await expl.explain({ task: 'test', domain: 'general', evidence: [] });
  // Non-deterministic genOpts only contains { maxTokens }; no temperature/top_k overrides.
  assert.ok(!('temperature' in capturedOpts), 'temperature should not be in non-deterministic opts');
  assert.ok(!('do_sample' in capturedOpts), 'do_sample should not be in non-deterministic opts');
});

// ---------------------------------------------------------------------------
// destroy() safety
// ---------------------------------------------------------------------------

test('Explainer.destroy() is safe when adapter has no destroy method', async () => {
  const expl = new Explainer({ generate: async () => ({ text: '{}' }) });
  await expl.destroy(); // must not throw
});
