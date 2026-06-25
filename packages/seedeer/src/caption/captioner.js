import { WorkerPool } from '../shared/worker-pool.js';
import { chunk } from '../shared/chunk.js';

const ENGINE_PATH = new URL('./caption-engine.js', import.meta.url).href;

/**
 * Generic image captioning (image-to-text models). Fixed-style
 * descriptions, not question-driven — see VqaAssistant for that. See
 * docs/features/captioning.md.
 */
export class Captioner {
  #pool;
  #batchSize;
  #maxNewTokens;

  constructor(pool, batchSize, maxNewTokens) {
    this.#pool = pool;
    this.#batchSize = batchSize;
    this.#maxNewTokens = maxNewTokens;
  }

  /**
   * @param {string} modelName              Hugging Face model identifier
   * @param {object} [options]
   * @param {string} [options.mode]         'process' | 'thread' | 'socket' | 'grpc' (default: 'process')
   * @param {string} [options.device]       'cpu' | 'gpu' | 'auto' (default: 'auto')
   * @param {string} [options.provider]     'cpu' | 'cuda' | 'dml'
   * @param {number} [options.batchSize]    Images per worker task (default: 8)
   * @param {number} [options.concurrency]  Parallel workers (default: 2)
   * @param {number} [options.maxNewTokens] Generation length cap (default: 50)
   * @param {string} [options.cacheDir]     Model cache directory (default: ~/.seedeer/models)
   * @param {Array}  [options.servers]      For 'socket'/'grpc' modes: server addresses to round-robin across.
   * @returns {Promise<Captioner>}
   */
  static async create(modelName, options = {}) {
    const {
      mode = 'process',
      device = 'auto',
      provider,
      batchSize = 8,
      concurrency = 2,
      maxNewTokens = 50,
      cacheDir,
      dtype,
      servers,
    } = options;

    const pool = new WorkerPool(ENGINE_PATH, {
      mode,
      concurrency,
      servers,
      engineOptions: { modelName, device, provider, cacheDir, dtype },
    });
    await pool.initialize();
    return new Captioner(pool, batchSize, maxNewTokens);
  }

  /**
   * @param {Array<string|Buffer>} images  File paths/URLs or image buffers
   * @returns {Promise<string[]>}          One caption per input image, same order
   */
  async caption(images) {
    const batches = chunk(images, this.#batchSize);
    const results = await Promise.all(
      batches.map((batchImages) =>
        this.#pool.run({ type: 'caption', images: batchImages, maxNewTokens: this.#maxNewTokens }),
      ),
    );
    return results.flat();
  }

  async destroy() {
    await this.#pool.destroy();
  }
}
