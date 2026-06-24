# Feature spec — Visual Question Answering (VQA)

## Goal

Answer a specific natural-language question about an image — "is the door
open?", "what brand is the laptop?" — using a vision-language model. Unlike
captioning, the output is driven by the question, not a fixed description
style.

## Public API (target shape, Phase 3)

```js
import { VqaAssistant } from '@jsilvanus/seedeer';

// Local backend (default) — small in-process VLM
const vqa = await VqaAssistant.create({
  backend: 'local',
  model: 'Xenova/some-small-vlm',
  mode: 'process',
});

// Remote backend — delegate to an OpenAI-compatible vision endpoint
const vqaRemote = await VqaAssistant.create({
  backend: 'remote',
  endpoint: 'http://localhost:11434/v1',   // e.g. Ollama
  model: 'qwen2-vl',
});

const answer = await vqa.ask(imagePathOrBuffer, 'Is the door open?');
// → string

await vqa.destroy();
```

## Behavioral requirements

- `backend: 'local'` and `backend: 'remote'` must implement the exact same
  interface (`ask(image, question)` → `Promise<string>`); calling code
  never branches on which backend is configured.
- The "remote" backend is the **only** place in seedeer that talks
  OpenAI-compatible HTTP on the wire, and it does so internally — the
  consumer of `VqaAssistant` still never constructs a URL or calls `fetch`
  themselves. This mirrors chattydeer's provider adapter pattern
  intentionally, so the two projects feel consistent.
- `backend: 'remote'` must surface a clear, distinguishable error if the
  endpoint is unreachable (do not silently fall back to local unless the
  caller explicitly opts into a fallback option).
- Local backend supports the same `mode`/`device`/`provider` options as
  other pillars.

## Open question (resolved during planning, recorded here for traceability)

VQA inference latency makes it unsuitable for the real-time
detect/track/zone-trigger loop (Phase 4). VQA is intentionally a separate,
latency-tolerant pillar, called on demand rather than per-frame.

## Out of scope for this feature

- Multi-turn visual conversation/memory (single question → single answer
  per call; conversation state, if ever needed, is layered on top by the
  caller or via chattydeer's `ChatSession`, not inside seedeer)
