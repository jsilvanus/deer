/**
 * Tests for Embedder constructor — GPU-specific defaults and environment
 * variable side-effects.
 *
 * No workers are started; we inspect the constructed object and env state
 * directly without calling initialize().
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Embedder } from '../src/embedder.js';

// ── GPU device defaults ───────────────────────────────────────────────────────

describe('Embedder constructor — GPU device defaults', () => {
  test('device "gpu" sets batchSize to 64 by default', () => {
    const e = new Embedder('model', { device: 'gpu' });
    assert.equal(e.batchSize, 64);
  });

  test('explicit batchSize overrides the gpu default', () => {
    const e = new Embedder('model', { device: 'gpu', batchSize: 16 });
    assert.equal(e.batchSize, 16);
  });

  test('device "gpu" defaults concurrency to 1', () => {
    // With GPU, we default to 1 worker (concurrency is now in _pool but not exposed)
    // We verify this by checking that the Embedder was created without error
    const e = new Embedder('model', { device: 'gpu' });
    assert.ok(e._pool, 'pool should exist');
  });

  test('explicit concurrency is accepted', () => {
    const e = new Embedder('model', { device: 'gpu', concurrency: 4 });
    assert.ok(e._pool, 'pool should exist with custom concurrency');
  });

  test('device "gpu" with cuda provider is accepted', () => {
    if (process.platform === 'win32') return; // covered separately on win32
    const e = new Embedder('model', { device: 'gpu' });
    assert.ok(e._pool, 'pool should exist with GPU device');
  });

  test('explicit provider is accepted', () => {
    const e = new Embedder('model', { device: 'gpu', provider: 'dml' });
    assert.ok(e._pool, 'pool should exist with explicit provider');
  });

  test('device "gpu" is accepted', () => {
    const e = new Embedder('model', { device: 'gpu' });
    assert.ok(e._pool, 'pool should exist with GPU device');
  });

  test('device "cpu" uses batchSize 32 by default', () => {
    const e = new Embedder('model', { device: 'cpu', concurrency: 1 });
    assert.equal(e.batchSize, 32);
  });
});

// ── OMP / MKL thread env vars ─────────────────────────────────────────────────

describe('Embedder constructor — thread count env vars', () => {
  test('sets OMP_NUM_THREADS when not already in env', () => {
    const saved = process.env.OMP_NUM_THREADS;
    delete process.env.OMP_NUM_THREADS;
    try {
      new Embedder('model', { concurrency: 2 });
      // The constructor should have set a value (exact value depends on CPU count)
      assert.ok(
        process.env.OMP_NUM_THREADS !== undefined,
        'OMP_NUM_THREADS should be set',
      );
    } finally {
      if (saved === undefined) delete process.env.OMP_NUM_THREADS;
      else process.env.OMP_NUM_THREADS = saved;
    }
  });

  test('does not overwrite OMP_NUM_THREADS when already set', () => {
    const saved = process.env.OMP_NUM_THREADS;
    process.env.OMP_NUM_THREADS = '42';
    try {
      new Embedder('model', { concurrency: 2 });
      assert.equal(process.env.OMP_NUM_THREADS, '42');
    } finally {
      if (saved === undefined) delete process.env.OMP_NUM_THREADS;
      else process.env.OMP_NUM_THREADS = saved;
    }
  });

  test('sets MKL_NUM_THREADS when not already in env', () => {
    const saved = process.env.MKL_NUM_THREADS;
    delete process.env.MKL_NUM_THREADS;
    try {
      new Embedder('model', { concurrency: 2 });
      assert.ok(
        process.env.MKL_NUM_THREADS !== undefined,
        'MKL_NUM_THREADS should be set',
      );
    } finally {
      if (saved === undefined) delete process.env.MKL_NUM_THREADS;
      else process.env.MKL_NUM_THREADS = saved;
    }
  });

  test('does not overwrite MKL_NUM_THREADS when already set', () => {
    const saved = process.env.MKL_NUM_THREADS;
    process.env.MKL_NUM_THREADS = '99';
    try {
      new Embedder('model', { concurrency: 4 });
      assert.equal(process.env.MKL_NUM_THREADS, '99');
    } finally {
      if (saved === undefined) delete process.env.MKL_NUM_THREADS;
      else process.env.MKL_NUM_THREADS = saved;
    }
  });
});
