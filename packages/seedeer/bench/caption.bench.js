// Benchmark captioning throughput. Downloads real models from the
// Hugging Face Hub on first run. Usage: node bench/caption.bench.js
import { Captioner } from '../src/index.js';
import { bench, CAT_IMAGE } from './_util.js';

const captioner = await Captioner.create('Xenova/vit-gpt2-image-captioning', {
  mode: 'process',
  concurrency: 1,
});
await bench('Captioner.caption (1 image)', () => captioner.caption([CAT_IMAGE]), { iterations: 10 });
await captioner.destroy();
