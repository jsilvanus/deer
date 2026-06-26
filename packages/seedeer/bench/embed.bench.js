// Benchmark image-embedding throughput. Downloads real models from the
// Hugging Face Hub on first run. Usage: node bench/embed.bench.js
import { JointEmbedder, VisualEmbedder } from '../src/index.js';
import { bench, CAT_IMAGE } from './_util.js';

const joint = await JointEmbedder.create('Xenova/clip-vit-base-patch32', {
  mode: 'process',
  concurrency: 1,
});
await bench('JointEmbedder.embedImages (1 image)', () => joint.embedImages([CAT_IMAGE]));
await bench('JointEmbedder.embedText (1 text)', () => joint.embedText(['a photo of a cat']));
await joint.destroy();

const visual = await VisualEmbedder.create('onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX', {
  mode: 'process',
  concurrency: 1,
});
await bench('VisualEmbedder.embedImages (1 image)', () => visual.embedImages([CAT_IMAGE]));
await visual.destroy();
