/**
 * Generic child-process worker entry point used by WorkerPool in 'process'
 * mode. Dynamically imports the engine module named in the 'init' message
 * and forwards 'task' messages to it. Not meant to be imported directly.
 */
let engine;

process.on('message', async (msg) => {
  try {
    if (msg.type === 'init') {
      const mod = await import(msg.enginePath);
      engine = await mod.createEngine(msg.engineOptions);
      process.send({ type: 'ready' });
      return;
    }
    if (msg.type === 'task') {
      const result = await engine.run(msg.task);
      process.send({ type: 'result', id: msg.id, result });
      return;
    }
    if (msg.type === 'shutdown') {
      if (engine?.dispose) await engine.dispose();
      process.exit(0);
    }
  } catch (err) {
    process.send({
      type: 'error',
      id: msg?.id,
      error: { message: err?.message ?? String(err), stack: err?.stack },
    });
  }
});
