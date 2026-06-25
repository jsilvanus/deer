import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { WorkerPool } from '../src/shared/worker-pool.js';
import { startSocketServer } from '../src/socket-model-server.js';
import { startGrpcServer } from '../src/grpc-model-server.js';

const ECHO_ENGINE = new URL('./fixtures/echo-engine.js', import.meta.url).href;

test('WorkerPool (socket mode) round-trips through socket-model-server', async () => {
  const socketPath = path.join(os.tmpdir(), `seedeer-test-${process.pid}.sock`);
  const server = await startSocketServer({
    enginePath: ECHO_ENGINE,
    engineOptions: { greeting: 'socket-hi' },
    concurrency: 1,
    socketPath,
  });

  try {
    const pool = new WorkerPool(ECHO_ENGINE, { mode: 'socket', servers: [socketPath] });
    const result = await pool.run({ type: 'ping' });
    assert.equal(result.echoedOptions.greeting, 'socket-hi');
    assert.equal(result.task.type, 'ping');
    await pool.destroy();
  } finally {
    await server.close();
  }
});

test('WorkerPool (socket mode) round-robins load across multiple servers', async () => {
  const socketPathA = path.join(os.tmpdir(), `seedeer-test-lb-a-${process.pid}.sock`);
  const socketPathB = path.join(os.tmpdir(), `seedeer-test-lb-b-${process.pid}.sock`);
  const serverA = await startSocketServer({
    enginePath: ECHO_ENGINE,
    engineOptions: { greeting: 'server-a' },
    concurrency: 1,
    socketPath: socketPathA,
  });
  const serverB = await startSocketServer({
    enginePath: ECHO_ENGINE,
    engineOptions: { greeting: 'server-b' },
    concurrency: 1,
    socketPath: socketPathB,
  });

  try {
    const pool = new WorkerPool(ECHO_ENGINE, { mode: 'socket', servers: [socketPathA, socketPathB] });
    const results = await Promise.all(
      Array.from({ length: 4 }, () => pool.run({ type: 'ping' })),
    );
    const greetings = results.map((r) => r.echoedOptions.greeting).sort();
    assert.deepEqual(greetings, ['server-a', 'server-a', 'server-b', 'server-b']);
    await pool.destroy();
  } finally {
    await Promise.all([serverA.close(), serverB.close()]);
  }
});

test('WorkerPool (grpc mode) round-trips through grpc-model-server', async () => {
  const server = await startGrpcServer({
    enginePath: ECHO_ENGINE,
    engineOptions: { greeting: 'grpc-hi' },
    concurrency: 1,
    host: '127.0.0.1',
    port: 0,
  });

  try {
    const pool = new WorkerPool(ECHO_ENGINE, { mode: 'grpc', servers: [server.address] });
    const result = await pool.run({ type: 'ping' });
    assert.equal(result.echoedOptions.greeting, 'grpc-hi');
    assert.equal(result.task.type, 'ping');
    await pool.destroy();
  } finally {
    await server.close();
  }
});
