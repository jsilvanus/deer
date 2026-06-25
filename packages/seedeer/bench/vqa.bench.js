// Benchmark VQA (local backend) throughput. Downloads real models from the
// Hugging Face Hub on first run. Usage: node bench/vqa.bench.js
import { VqaAssistant } from '../src/index.js';
import { bench, CAT_IMAGE } from './_util.js';

const vqa = await VqaAssistant.create({ backend: 'local', mode: 'process', concurrency: 1 });
await bench('VqaAssistant.ask (local backend)', () => vqa.ask(CAT_IMAGE, 'What animals are in this image?'), {
  iterations: 5,
});
await vqa.destroy();
