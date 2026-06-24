# Feature spec — Image embeddings

## Goal

Produce vector representations of images for two distinct purposes:
cross-modal search, and pure visual similarity. These are not the same
vector space and are not produced by the same model — see
`docs/ARCHITECTURE.md` for the rationale.

## Public API (target shape, Phase 1)

```js
import { JointEmbedder, VisualEmbedder } from '@jsilvanus/seedeer';

// Joint image-text space (CLIP/SigLIP-class)
const joint = await JointEmbedder.create('Xenova/clip-vit-base-patch32', {
  mode: 'process',       // 'process' | 'thread' | 'socket' | 'grpc'
  device: 'auto',        // 'cpu' | 'gpu' | 'auto'
  batchSize: 32,
  concurrency: 2,
});

const imageVecs = await joint.embedImages([imagePathOrBuffer, ...]);
const textVecs  = await joint.embedText(['a photo of a dog', ...]);
// imageVecs and textVecs are comparable via cosine similarity

await joint.destroy();

// Vision-only space (DINOv2-class) — image-to-image similarity only
const visual = await VisualEmbedder.create('Xenova/dinov2-base', {
  mode: 'process',
});
const vecs = await visual.embedImages([imagePathOrBuffer, ...]);
await visual.destroy();
```

## Behavioral requirements

- Both embedders accept the same `mode`/`device`/`provider`/`batchSize`/
  `concurrency`/`servers` options as embedeer's `Embedder`, with image
  inputs (file path, Buffer, or already-decoded tensor) in place of text.
- `JointEmbedder.embedImages()` and `JointEmbedder.embedText()` must
  produce vectors in the same normalized space (L2-normalized by default,
  matching embedeer's convention) so cosine similarity is directly
  meaningful across the two.
- `VisualEmbedder` exposes no text method — attempting to mix it with text
  embeddings is a caller error, not something this module silently allows.
- Model caching under `~/.seedeer/models`, override via `cacheDir`, same
  convention as embedeer's `~/.embedeer/models`.

## Out of scope for this feature

- Choosing/ranking search results — this module returns vectors, not a
  search index. Indexing/storage is the caller's job.
- OCR-derived text embeddings (OCR is a project-level non-goal).
