/**
 * Shared test helpers for embedeer tests.
 */

import { mock } from 'node:test';

/**
 * Returns a WorkerPool stub whose `run()` resolves with one
 * zero-vector per text (dimension 4).
 */
export function makeStubPool(overrides = {}) {
  return {
    _initialized: false,
    initialize: mock.fn(async function () {
      this._initialized = true;
    }),
    run: mock.fn(async (texts) => texts.map(() => [0, 0, 0, 0])),
    destroy: mock.fn(async () => {}),
    ...overrides,
  };
}

/**
 * Build an Embedder whose internal pool is replaced with `stubPool`.
 */
export async function makeEmbedder(stubPool, modelName = 'test-model', options = {}) {
  const { Embedder } = await import('../src/embedder.js');
  const e = new Embedder(modelName, options);
  e._pool = stubPool;
  // We've replaced the pool so we need to "manually" mark the pool initialized
  stubPool._initialized = true;
  stubPool.initialize = mock.fn(async () => {});
  return e;
}
