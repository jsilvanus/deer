# CLAUDE.md — seedeer

Vision-model toolkit for detection/tracking, visual question answering, captioning, and image embeddings. Shares nudeer's generic WorkerPool abstraction for local (process/thread) or remote (socket/gRPC) execution.

## Architecture

seedeer provides four independent "pillars" for vision tasks:

- **Detection + Tracking** — Real-time person/object detection with cross-frame tracking and named-zone enter/exit events (SessionStateful, frame-by-frame)
- **Visual Question Answering (VQA)** — Pluggable backends: local small VLM by default, or delegation to remote OpenAI-compatible endpoint (Ollama, vLLM, etc.)
- **Captioning** — Fast, cheap generic image descriptions
- **Image Embeddings** — Two model families: joint image-text space (CLIP/SigLIP) or vision-only (DINOv2) for cross-modal or image-to-image search

All pillars (except tracking, which is stateful/streaming) support four execution modes via `@jsilvanus/nudeer`:
- `process` — isolated child processes, one model copy each (default)
- `thread` — in-process worker_threads, lower overhead
- `socket` — shared daemon via Unix socket
- `grpc` — HTTP/2 service, local or remote

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full rationale.

## Commands

```bash
# Install dependencies
pnpm install

# Build / test / lint (use root-level commands)
pnpm --filter @jsilvanus/seedeer test
pnpm --filter @jsilvanus/seedeer build   # no build step needed; ES modules only

# Run tests
node --test test/*.test.js

# Run live tests (requires models)
node --test test/live/*.test.js

# Start socket daemon
pnpm --filter @jsilvanus/seedeer daemon   # node src/socket-model-server.js

# Start gRPC server
pnpm --filter @jsilvanus/seedeer server   # node src/grpc-model-server.js

# Run benchmarks
pnpm --filter @jsilvanus/seedeer bench    # embed, caption, vqa, detect
```

## Module System & Testing

- ES modules (`"type": "module"` in package.json); use `import`/`export` throughout
- Uses Node.js built-in test runner (`node --test`), no external test framework
- Tests are `.js` files in `test/` importing from `src/` (no build step needed)
- `@grpc/grpc-js` and `@grpc/proto-loader` are **optional** dependencies — lazy-loaded only when gRPC mode is used

## Package & Publishing

- **Package manager:** pnpm (monorepo)
- **Registry:** npm public (`publishConfig.access: "public"`)
- **Releases:** Handled by root `.changeset/` and `.github/workflows/release.yml`
- Depends on `@jsilvanus/nudeer` via `workspace:*`

## Key Files

- `src/index.js` — Public API exports (Detector, Captioner, VqaAssistant, JointEmbedder, VisualEmbedder, Tracker, ZoneTrigger, TrackingSession)
- `src/index.d.ts` — TypeScript type definitions
- `src/detector.js` — Object detection with YOLO-nano models
- `src/tracker.js` — Cross-frame tracking and ID persistence
- `src/zone-trigger.js` — Named-zone enter/exit event dispatch
- `src/tracking-session.js` — Streaming API for real-time detection + tracking
- `src/captioner.js` — Image captioning (BLIP-class models)
- `src/vqa-assistant.js` — Visual QA with pluggable backends (local or remote)
- `src/embedder.js` — Shared embedding base
- `src/joint-embedder.js` — Image-text embeddings (CLIP/SigLIP)
- `src/visual-embedder.js` — Vision-only embeddings (DINOv2)
- `src/socket-model-server.js` — Unix socket daemon for shared model across processes
- `src/grpc-model-server.js` — gRPC server (HTTP/2 + protobuf) for local or remote model serving
- `src/shared/worker-pool.js` — Generic WorkerPool (reuses nudeer's abstraction)
- `src/shared/grpc-client.js` — gRPC client connector

## Code Conventions

- **PascalCase** for classes: `Detector`, `Captioner`, `VqaAssistant`, `JointEmbedder`, `VisualEmbedder`, `Tracker`, `ZoneTrigger`, `TrackingSession`
- **camelCase** for functions: `createModelServerCore()`, `startGrpcServer()`, `startSocketServer()`
- **Underscore prefix** for private class members: `_pool`, `_session`, `_tracker`
- Import paths use `.js` extension (required for ES modules)

## Design Principles

1. **No HTTP in the consuming product** — `import` and call, never construct URLs
2. **Local-or-remote symmetry** — all pillars support process/thread/socket/grpc modes (except streaming tracking, which is inherently local)
3. **Pluggable backends where model strength > latency** — VQA backend is configurable (local VLM or remote endpoint)
4. **Reuse embedeer/nudeer patterns** — worker pool, provider loader, socket/gRPC server scaffolding
5. **No provisioning** — seedeer talks to configured endpoints, doesn't spin up cloud infra

## Testing

Tests use the **Node.js native `node:test`** module with `assert`.

```bash
node --test test/*.test.js       # Core unit tests
node --test test/live/*.test.js  # Live tests requiring actual models
```

Live tests are skipped in CI by default. When writing tests:
- Use `import { test } from 'node:test'` and `import assert from 'node:assert'`
- Mock WorkerPool and model servers to avoid loading real vision models
- Place test files in `test/` with naming pattern `<module>.test.js`
