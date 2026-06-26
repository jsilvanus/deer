# TODO

## seedeer — model upgrades deferred from contemporary-defaults pass

- **`Captioner`**: still defaults to `Xenova/vit-gpt2-image-captioning`. BLIP-class
  models aren't supported by Transformers.js's `image-to-text` pipeline, and
  Florence-2 is experimental and requires custom processor/model wiring
  (explicit task-prompt strings, non-pipeline `from_pretrained` usage) rather
  than a drop-in model-id swap. Needs a dedicated change to `caption-engine.js`.
- **`JointEmbedder`**: still defaults to `Xenova/clip-vit-base-patch32`. Moving to
  SigLIP would improve quality but requires swapping the explicit
  `CLIPTextModelWithProjection`/`CLIPVisionModelWithProjection` model classes in
  `embed-engine.js` for SigLIP's equivalents (different output keys), not just a
  model-id change.
