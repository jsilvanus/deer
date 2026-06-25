import { WorkerPool } from '../../shared/worker-pool.js';

const ENGINE_PATH = new URL('../vqa-engine.js', import.meta.url).href;

/**
 * In-process VQA backend (small VLM run locally via transformers.js/ONNX).
 * Implements the same `ask(image, question)` interface as the remote
 * backend — see docs/features/vqa.md.
 */
export class LocalVqaBackend {
  #pool;
  #maxNewTokens;

  constructor(pool, maxNewTokens) {
    this.#pool = pool;
    this.#maxNewTokens = maxNewTokens;
  }

  /**
   * @param {object} [options]
   * @param {string} [options.model]         Hugging Face model identifier (default: 'HuggingFaceTB/SmolVLM-256M-Instruct')
   * @param {string} [options.mode]          'process' | 'thread' | 'socket' | 'grpc' (default: 'process')
   * @param {string} [options.device]        'cpu' | 'gpu' | 'auto' (default: 'auto')
   * @param {string} [options.provider]      'cpu' | 'cuda' | 'dml'
   * @param {number} [options.concurrency]   Parallel workers (default: 1)
   * @param {number} [options.maxNewTokens]  Generation length cap (default: 100)
   * @param {string} [options.cacheDir]      Model cache directory (default: ~/.seedeer/models)
   * @param {Array}  [options.servers]       For 'socket'/'grpc' modes: server addresses to round-robin across.
   */
  static async create(options = {}) {
    const {
      model = 'HuggingFaceTB/SmolVLM-256M-Instruct',
      mode = 'process',
      device = 'auto',
      provider,
      concurrency = 1,
      maxNewTokens = 100,
      cacheDir,
      dtype,
      servers,
    } = options;

    const pool = new WorkerPool(ENGINE_PATH, {
      mode,
      concurrency,
      servers,
      engineOptions: { modelName: model, device, provider, cacheDir, dtype },
    });
    await pool.initialize();
    return new LocalVqaBackend(pool, maxNewTokens);
  }

  /**
   * @param {string|Buffer} image
   * @param {string} question
   * @returns {Promise<string>}
   */
  async ask(image, question) {
    return this.#pool.run({ type: 'ask', image, question, maxNewTokens: this.#maxNewTokens });
  }

  async destroy() {
    await this.#pool.destroy();
  }
}
