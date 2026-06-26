import { resolveProvider, defaultCacheDir } from '@jsilvanus/nudeer';
import { loadRawImage } from '../shared/image-input.js';

/**
 * Engine module loaded by WorkerPool workers (and by socket/grpc servers)
 * for Captioner. Not meant to be imported by consumers directly — go
 * through Captioner.
 */
export async function createEngine({ modelName, device, provider, cacheDir, dtype }) {
  const { pipeline } = await import('@huggingface/transformers');
  const resolvedDevice = await resolveProvider(device, provider);
  const cache_dir = cacheDir ?? defaultCacheDir('seedeer');

  const captioner = await pipeline('image-to-text', modelName, {
    cache_dir,
    device: resolvedDevice,
    dtype: dtype ?? 'fp32',
  });

  return {
    async run(task) {
      if (task.type !== 'caption') {
        throw new Error(`Unknown captioner task type "${task.type}".`);
      }
      const images = await Promise.all(task.images.map(loadRawImage));
      const outputs = await captioner(images, { max_new_tokens: task.maxNewTokens ?? 50 });
      const isBatched = Array.isArray(outputs[0]);
      return images.map((_, i) => {
        const out = isBatched ? outputs[i] : [outputs[i]];
        return out[0].generated_text.trim();
      });
    },
    async dispose() {
      await captioner.dispose?.();
    },
  };
}
