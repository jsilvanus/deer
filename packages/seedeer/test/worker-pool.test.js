import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkerPool } from '../src/shared/worker-pool.js';

const ECHO_ENGINE = new URL('./fixtures/echo-engine.js', import.meta.url).href;

for (const mode of ['process', 'thread']) {
  test(`WorkerPool (${mode} mode) initializes, dispatches, and echoes tasks`, async () => {
    const pool = new WorkerPool(ECHO_ENGINE, {
      mode,
      concurrency: 2,
      engineOptions: { greeting: 'hi' },
    });
    await pool.initialize();

    const results = await Promise.all([
      pool.run({ type: 'ping', n: 1 }),
      pool.run({ type: 'ping', n: 2 }),
      pool.run({ type: 'ping', n: 3 }),
    ]);

    for (const r of results) {
      assert.equal(r.echoedOptions.greeting, 'hi');
    }
    assert.deepEqual(results.map((r) => r.task.n).sort(), [1, 2, 3]);

    await pool.destroy();
  });

  test(`WorkerPool (${mode} mode) rejects only the failing task`, async () => {
    const pool = new WorkerPool(ECHO_ENGINE, { mode, concurrency: 1 });
    await pool.initialize();

    await assert.rejects(() => pool.run({ type: 'fail' }), /intentional failure/);
    const ok = await pool.run({ type: 'ping' });
    assert.equal(ok.task.type, 'ping');

    await pool.destroy();
  });
}
