import { WorkerPool } from '../shared/worker-pool.js';

const ENGINE_PATH = new URL('./embed-engine.js', import.meta.url).href;

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

/**
 * Image-text joint-space embedder (CLIP/SigLIP-class models). Image and
 * text vectors land in the same L2-normalized space, enabling cross-modal
 * search via cosine similarity. See docs/features/embeddings.md.
 */
export class JointEmbedder {
  #pool;
  #batchSize;

  constructor(pool, batchSize) {
    this.#pool = pool;
    this.#batchSize = batchSize;
  }

  /**
   * @param {string} modelName             Hugging Face model identifier
   * @param {object} [options]
   * @param {string} [options.mode]        'process' | 'thread' | 'socket' | 'grpc' (default: 'process')
   * @param {string} [options.device]      'cpu' | 'gpu' | 'auto' (default: 'auto')
   * @param {string} [options.provider]    'cpu' | 'cuda' | 'dml'
   * @param {number} [options.batchSize]   Images/texts per worker task (default: 32)
   * @param {number} [options.concurrency] Parallel workers (default: 2)
   * @param {string} [options.cacheDir]    Model cache directory (default: ~/.seedeer/models)
   * @param {Array}  [options.servers]     For 'socket'/'grpc' modes: server addresses to round-robin across.
   * @returns {Promise<JointEmbedder>}
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
      engineOptions: { kind: 'joint', modelName, device, provider, cacheDir, dtype },
    });
    await pool.initialize();
    return new JointEmbedder(pool, batchSize);
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

  /**
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedText(texts) {
    const batches = chunk(texts, this.#batchSize);
    const results = await Promise.all(
      batches.map((batchTexts) => this.#pool.run({ type: 'embedText', texts: batchTexts })),
    );
    return results.flat();
  }

  async destroy() {
    await this.#pool.destroy();
  }
}
