import { WorkerPool } from '@jsilvanus/nudeer';
import { chunk } from '../shared/chunk.js';

const ENGINE_PATH = new URL('./embed-engine.js', import.meta.url).href;

/**
 * Vision-only embedder (DINOv3-class models). Not comparable to text
 * embeddings — for image-to-image similarity, clustering, and
 * near-duplicate detection. See docs/features/embeddings.md.
 */
export class VisualEmbedder {
  #pool;
  #batchSize;

  constructor(pool, batchSize) {
    this.#pool = pool;
    this.#batchSize = batchSize;
  }

  /**
   * @param {string} modelName             Hugging Face model identifier
   * @param {object} [options]             Same shape as JointEmbedder options
   * @returns {Promise<VisualEmbedder>}
   */
  static async create(modelName, options = {}) {
    const {
      mode = 'process',
      device = 'auto',
      provider,
      batchSize = 32,
      concurrency = 2,
      cacheDir,
      dtype,
      servers,
    } = options;

    const pool = new WorkerPool(ENGINE_PATH, {
      mode,
      concurrency,
      servers,
      engineOptions: { kind: 'visual', modelName, device, provider, cacheDir, dtype },
    });
    await pool.initialize();
    return new VisualEmbedder(pool, batchSize);
  }

  /**
   * @param {Array<string|Buffer>} images  File paths/URLs or image buffers
   * @returns {Promise<number[][]>}
   */
  async embedImages(images) {
    const batches = chunk(images, this.#batchSize);
    const results = await Promise.all(
      batches.map((batchImages) => this.#pool.run({ type: 'embedImages', images: batchImages })),
    );
    return results.flat();
  }

  async destroy() {
    await this.#pool.destroy();
  }
}
