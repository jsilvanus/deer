import { WorkerPool } from './worker-pool.js';

/**
 * Shared core for socket-model-server.js and grpc-model-server.js: both are
 * thin network transports wrapping a local ('process' mode) WorkerPool, so
 * the parallelism/crash-isolation logic only needs to exist once.
 */
export function createModelServerCore({ enginePath, engineOptions, concurrency }) {
  const pool = new WorkerPool(enginePath, { mode: 'process', concurrency, engineOptions });
  return {
    async start() {
      await pool.initialize();
    },
    run(task) {
      return pool.run(task);
    },
    async stop() {
      await pool.destroy();
    },
  };
}
