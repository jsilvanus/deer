import test from 'node:test';
import assert from 'node:assert/strict';
import { FifoQueue } from '../src/shared/fifo-queue.js';

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
