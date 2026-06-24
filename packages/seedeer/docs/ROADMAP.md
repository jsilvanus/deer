# seedeer — Roadmap

Phased so each phase ships something independently useful and testable.
Order chosen by: lowest architectural risk first, real-time/streaming work
(the hardest part) last.

## Phase 0 — Scaffold (this PR)

- Package layout, planning docs, stub modules for all four pillars with
  the intended public API shape, CI skeleton.
- No working model inference yet. Every stub throws a clear "not
  implemented" error pointing back to this roadmap, so consumers can start
  writing integration code against the real shape before models are wired
  up.

## Phase 1 — Image embeddings

Lowest risk: closest in shape to embedeer's existing, proven embedding
pipeline (batch in, vectors out, no streaming, no generation).

- `JointEmbedder` (CLIP/SigLIP-class) — `embedImages()`, `embedText()`,
  both landing in the same vector space.
- `VisualEmbedder` (DINOv2-class) — `embedImages()` only.
- Reuse/adapt embedeer's `worker-pool.js` and `provider-loader.js` for
  image tensors.
- `process`/`thread`/`socket`/`grpc` modes, mirroring embedeer exactly.
- Model caching under `~/.seedeer/models`, same convention as embedeer.

## Phase 2 — Captioning

- `Captioner.caption(image)` → short text description.
- Single small model (BLIP-class), local-or-remote per the same mode
  options.
- Validates the "image in, generation out" path before VQA adds the
  complexity of a question prompt.

## Phase 3 — Visual Question Answering

- `VqaAssistant.ask(image, question)` → text answer.
- Backend abstraction: `backend: 'local'` (in-process small VLM) vs
  `backend: 'remote'` (delegate to a configured OpenAI-compatible vision
  endpoint, e.g. Ollama serving `qwen2-vl`/`llava`).
- Local and remote backends must satisfy the same interface so swapping
  config doesn't change calling code.

## Phase 4 — Detect + Track + Zone-trigger

Highest risk, done last, after the request/response patterns are proven.

- `Detector` — per-frame bounding boxes (YOLO-nano class ONNX model).
- `Tracker` — assigns persistent IDs across frames on top of `Detector`
  output (IOU tracker first; ByteTrack-class upgrade later if needed).
- `ZoneTrigger` — named regions (rect/polygon) + enter/exit event emission
  keyed on tracked IDs, not raw per-frame detections.
- Session-shaped API (open a tracking session, subscribe to events) rather
  than embedeer's call/return shape — see
  `docs/features/detection-tracking.md` for why.
- `process`/`thread` local modes first (latency-critical default); `grpc`
  remote mode added for symmetry once the local path is solid.

## Phase 5 — Hardening (ongoing, not blocking earlier phases)

- Benchmark scripts per pillar, mirroring embedeer's `bench/` directory.
- Multi-server load balancing for embeddings/VQA/captioning (same pattern
  as embedeer's `servers: []` option).
- Optional on-demand GPU VPS provisioning helper — explicitly a separate
  tool, not part of the seedeer package itself (see Non-goals in
  `docs/ARCHITECTURE.md`).

## Explicit non-goals (see ARCHITECTURE.md for rationale)

- OCR
- Image redaction/pixel mutation
- Cloud provisioning logic inside the package
