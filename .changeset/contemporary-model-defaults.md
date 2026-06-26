---
"@jsilvanus/embedeer": minor
"@jsilvanus/seedeer": minor
---

Update default models to more contemporary alternatives:

- `embedeer`: default embedding model is now `onnx-community/gte-multilingual-base` (768-dim, multilingual GTE) instead of the 2021-era `Xenova/all-MiniLM-L6-v2`. Also fixes an existing bug where the `Embedder` constructor's fallback model name (`nomic-embed-text`) was not a valid Hugging Face repo id.
- `seedeer`: `Detector`'s default model is now `onnx-community/rtdetr_r18vd` (RT-DETR) instead of `Xenova/yolos-tiny`. `VisualEmbedder` examples/benchmarks now use DINOv3 (`onnx-community/dinov3-vit{s,b}16-pretrain-lvd1689m-ONNX`) instead of DINOv2.

These are drop-in replacements using the same pipeline/model-class APIs. `Captioner` (BLIP/Florence-2 alternatives aren't simple drop-ins for the `image-to-text` pipeline) and `JointEmbedder` (switching CLIP to SigLIP requires different model classes) were left unchanged — flagged separately for a follow-up.
