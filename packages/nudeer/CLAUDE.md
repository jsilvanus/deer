# nudeer CLAUDE.md

Generic worker pool and model server infrastructure shared by embedeer, seedeer, and other model-serving packages.

## Architecture

nudeer provides a **generic WorkerPool** that decouples the execution environment from the application logic:

- **WorkerPool** — orchestrates `process`, `thread`, `socket`, and `gRPC` modes
- **Engines** — pluggable modules exporting `async createEngine(options)` that return `{ run(task), dispose() }`
- **Process/Thread workers** — spawn local workers via child_process or worker_threads
- **Socket/gRPC clients** — connect to pre-started or auto-spawned model servers
- **Model server core** — thin wrapper to run an engine behind a network interface

## Module System & Testing

- ES modules (`"type": "module"` in package.json); use `import`/`export` throughout
- Uses Node.js built-in test runner (`node --test`)
- `@grpc/grpc-js` and `@grpc/proto-loader` are **optional** dependencies — lazy-loaded only when gRPC mode is used

## Usage

### As a library consumer (embedeer, seedeer, etc.)

```js
import { WorkerPool } from '@jsilvanus/nudeer';

const pool = new WorkerPool('/path/to/engine.js', {
  mode: 'process',       // or 'thread', 'socket', 'grpc'
  concurrency: 4,
  engineOptions: { /* passed to createEngine */ },
  servers: ['localhost:50051'] // for socket/grpc modes
});

await pool.initialize();
const result = await pool.run({ text: 'hello' });
await pool.destroy();
```

### Engine module

An engine module exports:

```js
export async function createEngine(options) {
  return {
    async run(task) { /* return result */ },
    async dispose() { /* cleanup */ }
  };
}
```

The engine is instantiated once per worker and reused across many `run()` calls.

## Package & Publishing

- **Package manager:** npm
- **Registry:** npm public (`publishConfig.access: "public"`)
- **Releases:** Handled by root `.changeset/` and `.github/workflows/release.yml`
