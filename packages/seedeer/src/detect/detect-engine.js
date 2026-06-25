import { resolveDevice, defaultCacheDir } from '@jsilvanus/nudeer';
import { loadRawImage } from '../shared/image-input.js';

/**
 * Engine module loaded by WorkerPool workers for Detector. Not meant to be
 * imported by consumers directly — go through Detector.
 */
export async function createEngine({ modelName, device, provider, cacheDir, dtype }) {
  const { pipeline } = await import('@huggingface/transformers');
  const resolvedDevice = resolveDevice({ device, provider });
  const cache_dir = cacheDir ?? defaultCacheDir('seedeer');

  const detector = await pipeline('object-detection', modelName, {
    cache_dir,
    device: resolvedDevice,
    dtype: dtype ?? 'fp32',
  });

  return {
    async run(task) {
      if (task.type !== 'detect') {
        throw new Error(`Unknown detector task type "${task.type}".`);
      }
      const image = await loadRawImage(task.frame);
      const outputs = await detector(image, { threshold: task.threshold ?? 0.5 });
      return outputs
        .filter((o) => !task.label || o.label === task.label)
        .map((o) => ({
          x: o.box.xmin,
          y: o.box.ymin,
          width: o.box.xmax - o.box.xmin,
          height: o.box.ymax - o.box.ymin,
          score: o.score,
        }));
    },
    async dispose() {
      await detector.dispose?.();
    },
  };
}
