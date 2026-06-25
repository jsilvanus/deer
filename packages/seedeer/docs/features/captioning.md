# Feature spec — Captioning

## Goal

Cheap, fast, generic image descriptions — "a dog running on a beach" — for
auto-tagging, alt-text, or feeding a downstream index. Not a substitute for
VQA: no question is asked, the output is a fixed-style description.

## Public API (target shape, Phase 2)

```js
import { Captioner } from '@jsilvanus/seedeer';

const captioner = await Captioner.create('Xenova/vit-gpt2-image-captioning', {
  mode: 'process',
  device: 'auto',
});

const captions = await captioner.caption([imagePathOrBuffer, ...]);
// → string[], one caption per input image

await captioner.destroy();
```

## Behavioral requirements

- Batched input like embedeer's `embed()` — accepts an array, returns an
  array in the same order.
- Same `mode`/`device`/`provider`/`servers` options as every other pillar.
- Deterministic-enough output is preferred over creative sampling — this
  is meant for indexing/tagging, not prose generation. Sampling
  temperature, if exposed, should default low.

## Out of scope for this feature

- Answering specific questions about image content (→ VQA, see
  `docs/features/vqa.md`)
- Structured tags/labels (a future zero-shot classification feature could
  use the `JointEmbedder` from the embeddings pillar instead)
