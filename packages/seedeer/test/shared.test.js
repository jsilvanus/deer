import test from 'node:test';
import assert from 'node:assert/strict';
import { FifoQueue } from '../src/shared/fifo-queue.js';
import { resolveDevice } from '../src/shared/provider-loader.js';

test('FifoQueue preserves insertion order and tracks length', () => {
  const q = new FifoQueue();
  assert.equal(q.length, 0);
  q.push('a');
  q.push('b');
  q.push('c');
  assert.equal(q.length, 3);
  assert.equal(q.shift(), 'a');
  assert.equal(q.shift(), 'b');
  assert.equal(q.length, 1);
  assert.equal(q.shift(), 'c');
  assert.equal(q.shift(), undefined);
});

test('resolveDevice: explicit provider always wins', () => {
  assert.equal(resolveDevice({ device: 'cpu', provider: 'cuda' }), 'cuda');
});

test('resolveDevice: device "cpu" returns cpu', () => {
  assert.equal(resolveDevice({ device: 'cpu' }), 'cpu');
});

test('resolveDevice: rejects unknown device strings', () => {
  assert.throws(() => resolveDevice({ device: 'tpu' }), /Unknown device/);
});
