import { parentPort } from 'node:worker_threads';

/**
 * Generic worker_threads entry point used by WorkerPool in 'thread' mode.
 * Mirrors process-worker-entry.js exactly, just over postMessage instead
 * of process IPC. Not meant to be imported directly.
 */
let engine;

parentPort.on('message', async (msg) => {
  try {
    if (msg.type === 'init') {
      const mod = await import(msg.enginePath);
      engine = await mod.createEngine(msg.engineOptions);
      parentPort.postMessage({ type: 'ready' });
      return;
    }
    if (msg.type === 'task') {
      const result = await engine.run(msg.task);
      parentPort.postMessage({ type: 'result', id: msg.id, result });
      return;
    }
    if (msg.type === 'shutdown') {
      if (engine?.dispose) await engine.dispose();
      process.exit(0);
    }
  } catch (err) {
    parentPort.postMessage({
      type: 'error',
      id: msg?.id,
      error: { message: err?.message ?? String(err), stack: err?.stack },
    });
  }
});
