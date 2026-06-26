import { WorkerPool } from '@jsilvanus/nudeer';

const ENGINE_PATH = new URL('./detect-engine.js', import.meta.url).href;

/**
 * Per-frame person detection (RT-DETR-class ONNX model run through an
 * object-detection pipeline, filtered to a single label by default). Fast,
 * stateless on its own — see TrackingSession for the stateful pipeline
 * built on top. See docs/features/detection-tracking.md.
 */
export class Detector {
  #pool;
  #label;
  #threshold;

  constructor(pool, label, threshold) {
    this.#pool = pool;
    this.#label = label;
    this.#threshold = threshold;
  }

  /**
   * @param {object} [options]
   * @param {string} [options.model]     Model identifier (default: 'onnx-community/rtdetr_r18vd')
   * @param {string} [options.mode]      'process' | 'thread' | 'socket' | 'grpc' (default: 'process')
   * @param {string} [options.device]    'cpu' | 'gpu' | 'auto' (default: 'auto')
   * @param {string} [options.provider]  'cpu' | 'cuda' | 'dml'
   * @param {string|null} [options.label]    Class label to keep (default: 'person'; pass null for all classes)
   * @param {number} [options.threshold]     Score threshold (default: 0.5)
   * @param {number} [options.concurrency]   Parallel workers (default: 1)
   * @param {string} [options.cacheDir]      Model cache directory (default: ~/.seedeer/models)
   * @param {Array}  [options.servers]       For 'socket'/'grpc' modes: server addresses to round-robin across.
   * @returns {Promise<Detector>}
   */
  static async create(options = {}) {
    const {
      model = 'onnx-community/rtdetr_r18vd',
      mode = 'process',
      device = 'auto',
      provider,
      label = 'person',
      threshold = 0.5,
      concurrency = 1,
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
    return new Detector(pool, label, threshold);
  }

  /**
   * @param {Buffer|string} frame  A single decoded video frame (path/URL/Buffer)
   * @returns {Promise<Array<{ x: number, y: number, width: number, height: number, score: number }>>}
   */
  async detect(frame) {
    return this.#pool.run({ type: 'detect', frame, label: this.#label, threshold: this.#threshold });
  }

  async destroy() {
    await this.#pool.destroy();
  }
}
