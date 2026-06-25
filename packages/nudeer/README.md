# nudeer

Generic worker pool and model server infrastructure for Node.js model serving applications.

**nudeer** (nude + deer = just the core) provides a reusable WorkerPool abstraction that supports multiple execution modes — process isolation, worker threads, Unix sockets, and gRPC — without tying application code to any one transport.

It's the foundation for [`@jsilvanus/embedeer`](https://github.com/jsilvanus/deer) (text embeddings), [`@jsilvanus/seedeer`](https://github.com/jsilvanus/deer) (vision), and can be used to build model servers for any task.

## Features

- **Pluggable execution modes:** `process`, `thread`, `socket` (shared daemon), `gRPC` (remote/cross-language)
- **Generic engine abstraction:** Any module exporting `createEngine(options) -> { run(task), dispose() }` works
- **Automatic or manual server management:** Spawn model servers on demand or connect to pre-running daemons
- **Zero-overhead lazy loading:** gRPC dependencies only imported when actually used
- **Multi-server load balancing:** Distribute work across multiple servers (e.g., GPU + CPU)
- **First-class TypeScript definitions**

## Installation

```bash
npm install @jsilvanus/nudeer
```

## Usage

```js
import { WorkerPool } from '@jsilvanus/nudeer';

// Create a pool — here using an hypothetical embedding engine
const pool = new WorkerPool(
  './embedding-engine.js',  // path to engine module
  {
    mode: 'process',         // 'process' | 'thread' | 'socket' | 'grpc'
    concurrency: 4,          // number of local workers (for process/thread)
    engineOptions: {         // passed to createEngine()
      modelName: 'bert-base',
    },
  }
);

await pool.initialize();

// Run tasks
const result = await pool.run({ texts: ['hello', 'world'] });

// Clean up
await pool.destroy();
```

## Engine Contract

An engine module must export an async `createEngine(options)` function:

```js
export async function createEngine(options) {
  // Load model, initialize resources, etc.
  const model = await loadModel(options.modelName);

  return {
    async run(task) {
      // Process task and return result
      return await model.inference(task);
    },

    async dispose() {
      // Optional: cleanup (models, connections, etc.)
      await model.unload();
    },
  };
}
```

## Execution Modes

| Mode | Use case | Isolation |
|------|----------|-----------|
| `process` | Default, safest; each worker is an isolated child process | ✅ Per-worker |
| `thread` | Lower memory; workers are `worker_threads` in the same process | ⚠️ Shared memory |
| `socket` | Shared daemon across multiple OS processes (e.g., web server + background jobs) | ✅ Server crash isolated |
| `grpc` | Remote servers, cross-language clients, multi-server LB with built-in round-robin | ✅ Per-server |

## Multi-Server Load Balancing

For socket/gRPC modes, pass a `servers` option:

```js
const pool = new WorkerPool('./engine.js', {
  mode: 'grpc',
  servers: [
    'gpu-server-1:50051',
    'gpu-server-2:50051',
    'cpu-server:50051',
  ],
});
```

All three servers receive requests in a round-robin fashion (or with natural weights if using the WorkerPool-level LB approach).

## License

MIT
