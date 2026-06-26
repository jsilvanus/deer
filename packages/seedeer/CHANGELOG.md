# @jsilvanus/seedeer

## 0.3.0

### Minor Changes

- a3b42c0: Update default models to more contemporary alternatives:

  - `embedeer`: default embedding model is now `onnx-community/gte-multilingual-base` (768-dim, multilingual GTE) instead of the 2021-era `Xenova/all-MiniLM-L6-v2`. Also fixes an existing bug where the `Embedder` constructor's fallback model name (`nomic-embed-text`) was not a valid Hugging Face repo id.
  - `seedeer`: `Detector`'s default model is now `onnx-community/rtdetr_r18vd` (RT-DETR) instead of `Xenova/yolos-tiny`. `VisualEmbedder` examples/benchmarks now use DINOv3 (`onnx-community/dinov3-vit{s,b}16-pretrain-lvd1689m-ONNX`) instead of DINOv2.

  These are drop-in replacements using the same pipeline/model-class APIs. `Captioner` (BLIP/Florence-2 alternatives aren't simple drop-ins for the `image-to-text` pipeline) and `JointEmbedder` (switching CLIP to SigLIP requires different model classes) were left unchanged — flagged separately for a follow-up.

### Patch Changes

- 0327647: Fix markdown links pointing to old standalone-repo GitHub orgs; point them at the monorepo (`jsilvanus/deer`) instead.
- f2a02d5: No functional change — documents in TODO.md the deferred `Captioner` (BLIP/Florence-2) and `JointEmbedder` (SigLIP) model upgrades that were left out of the contemporary-defaults pass.
- 6499111: Unify GPU provider resolution across all packages via nudeer.

  **nudeer:** Export sophisticated `resolveProvider(device, provider)` with CUDA library verification, ldconfig caching, and detailed error messages. Replaces simple `resolveDevice` to provide production-quality GPU detection.

  **embedeer & seedeer:** Refactor to import `resolveProvider` from nudeer. All packages now use the same CUDA detection logic with library verification and helpful installation instructions. No public API changes.

  Consolidates provider detection code, eliminating 3 duplicate implementations.

- Updated dependencies [0327647]
- Updated dependencies [6499111]
  - @jsilvanus/nudeer@0.2.0

## 0.2.0

### Minor Changes

- 586101c: Merge seedeer, embedeer, and chattydeer into a single `deer` pnpm-workspace monorepo. No functional changes to package behavior — this consolidates CI, releases, and Changesets into one repository (`jsilvanus/deer`) with full git history preserved for all three packages.

### Patch Changes

- 87dcb5a: Update README logo references to use package-specific asset filenames (chattydeer.png, embedeer.png, nudeer.png, seedeer.png) instead of generic logo.png naming. Add logo badges to nudeer and seedeer READMEs.
- Updated dependencies [87dcb5a]
  - @jsilvanus/nudeer@0.1.1
