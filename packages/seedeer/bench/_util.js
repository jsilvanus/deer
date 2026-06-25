import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CAT_IMAGE = path.join(__dirname, '..', 'test', 'fixtures', 'cats.jpg');

/**
 * Runs `fn()` `iterations` times (plus `warmup` untimed runs first) and
 * prints latency/throughput stats for `label`.
 */
export async function bench(label, fn, { iterations = 20, warmup = 3 } = {}) {
  for (let i = 0; i < warmup; i++) await fn();

  const durationsMs = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    durationsMs.push(performance.now() - start);
  }

  durationsMs.sort((a, b) => a - b);
  const sum = durationsMs.reduce((a, b) => a + b, 0);
  const mean = sum / durationsMs.length;
  const p50 = durationsMs[Math.floor(durationsMs.length * 0.5)];
  const p95 = durationsMs[Math.floor(durationsMs.length * 0.95)];
  const throughput = 1000 / mean;

  console.log(
    `${label}: mean=${mean.toFixed(1)}ms p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms ` +
      `throughput=${throughput.toFixed(2)}/s (n=${iterations})`,
  );
}
