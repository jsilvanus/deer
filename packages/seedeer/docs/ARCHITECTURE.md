# seedeer — Architecture

## What this project is

seedeer is the vision counterpart to [`@jsilvanus/embedeer`](https://github.com/jsilvanus/deer/tree/main/packages/embedeer)
(local text embeddings) and [`@jsilvanus/chattydeer`](https://github.com/jsilvanus/deer/tree/main/packages/chattydeer)
(LLM chat/agentic toolkit). It provides vision-model functionality —
detection/tracking, visual question answering, captioning, and image
embeddings — as a directly importable ESM library, not an HTTP service.

It is a sibling, not a dependency of either: chattydeer or any other
consumer (e.g. an external production-assistant program) can import and use
seedeer's pieces independently. seedeer never assumes it is being driven by
a specific downstream product.

## Design principles

These carry over directly from embedeer and apply to every feature below.

1. **No HTTP in the consuming product.** A consumer does
   `import { X } from '@jsilvanus/seedeer'` and calls a method. It never
   constructs a URL or issues a `fetch()`/HTTP client call itself. Whether
   the call is served in-process, by a local daemon, or by a remote server
   is an internal detail selected by configuration.

2. **Local-or-remote symmetry, for every feature.** Every feature (not just
   the latency-tolerant ones) supports the same `mode` spectrum embedeer
   already implements:
   - `process` — isolated child-process worker(s), one model copy each (default)
   - `thread` — in-process worker_threads, lower overhead
   - `socket` — one persistent daemon shared across OS processes on the same host
   - `grpc` — typed HTTP/2 service, local or remote, including a GPU box
     spun up on demand elsewhere

   This applies to the real-time detection/tracking path too. It defaults to
   `process`/`thread` for latency, but nothing stops pointing it at a remote
   `grpc` server if the network hop is fast enough for the use case — the
   API surface does not change either way.

3. **Pluggable backends where model strength matters more than latency.**
   VQA in particular should not hard-wire one model. Mirroring chattydeer's
   provider-agnostic chat adapter, a VQA backend is configurable: an
   in-process small VLM by default, or delegation to an already-running
   OpenAI-compatible vision endpoint (Ollama, vLLM, etc.) for stronger
   answers. The public call shape (`vqa.ask(image, question)`) is identical
   either way.

4. **Reuse embedeer's runtime, don't reinvent it.** Worker pool management,
   ONNX/transformers.js provider selection (`device`/`provider` resolution
   for `cpu`/`cuda`/`dml`), model caching, and the socket/grpc server
   scaffolding are proven in embedeer. seedeer adapts that code for image
   tensors and vision model classes rather than writing a parallel
   implementation from scratch.

5. **Provisioning is out of scope.** seedeer knows how to talk to a
   configured endpoint (local, socket, or remote grpc address). It does not
   provision cloud infrastructure. Spinning up a GPU VPS on demand is a
   separate, later concern — a small orchestration script that starts a
   seedeer grpc server on a box and hands the resulting address to the
   config, not something seedeer does to itself.

## The four feature pillars

| Pillar | Latency need | Backend choice | Model class |
|---|---|---|---|
| Detect + Track + Zone-trigger | Near-instantaneous (frame-rate) | local by default, remote-capable for symmetry | small/fast detector (YOLO-nano class) + lightweight tracker |
| Visual Question Answering | Tolerant | pluggable (local small VLM, or remote/Ollama-compatible) | vision-language model |
| Captioning | Tolerant, but cheap | local by default | small captioning model (BLIP-class) |
| Image embeddings | Tolerant | local-or-remote, same as embedeer | two separate model families — see below |

OCR is explicitly out of scope (decided against during planning).

### Why detection/tracking is architecturally distinct

Every other pillar is a request/response call: image in, answer/vector out.
Detection + tracking is a **stream**: frames arrive continuously, state
(tracked IDs, positions) persists across calls, and "did someone enter zone
B" is a derived event, not a return value of any single inference call. This
pillar therefore has its own session-shaped API (open a tracking session on
a video source, subscribe to zone events) rather than embedeer's
call-and-return shape. See `docs/features/detection-tracking.md`.

### Why embeddings need two model families, not one

- **Joint image-text space** (CLIP/SigLIP-class): image and text vectors
  live in the same space, enabling cross-modal search (text query → image
  results, or vice versa).
- **Vision-only space** (DINOv2-class): not comparable to text embeddings,
  but generally stronger for pure image-to-image similarity, clustering, and
  near-duplicate detection than a CLIP image tower (which trades some visual
  fidelity for text alignment).

These are exposed as two distinct calls backed by two distinct models, not
one generic "embed image" function. See `docs/features/embeddings.md`.

## Relationship to embedeer and chattydeer

- seedeer does **not** depend on embedeer or chattydeer at runtime. It
  borrows/adapts their proven internal patterns (worker pool, provider
  loader, socket/grpc server shape) as a design template, duplicated and
  adjusted for vision inputs, not imported as a dependency edge.
- chattydeer (or LCYT, or any other product) consumes seedeer the same way
  it would consume any other npm package: import, call, done. seedeer has
  zero knowledge of any specific consumer.
- The VQA backend's "delegate to an OpenAI-compatible endpoint" option
  intentionally mirrors chattydeer's own provider adapter, so the two
  projects feel consistent if used side by side, without one requiring the
  other.

## Non-goals

- OCR (explicitly dropped)
- Image redaction / pixel editing (seedeer returns boxes/masks/answers; any
  actual image mutation is left to the caller)
- Cloud GPU provisioning
- Tight coupling to any specific downstream consumer (e.g. LCYT)
