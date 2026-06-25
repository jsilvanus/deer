// Benchmark per-frame detection throughput — the latency-critical pillar.
// Downloads real models from the Hugging Face Hub on first run.
// Usage: node bench/detect.bench.js
import { Detector } from '../src/index.js';
import { bench, CAT_IMAGE } from './_util.js';

const detector = await Detector.create({ mode: 'process', concurrency: 1, label: null });
await bench('Detector.detect (1 frame)', () => detector.detect(CAT_IMAGE), { iterations: 30 });
await detector.destroy();
