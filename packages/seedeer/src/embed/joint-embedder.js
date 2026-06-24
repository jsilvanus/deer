import { NotImplementedError } from '../errors.js';

/**
 * Image-text joint-space embedder (CLIP/SigLIP-class models).
 * Image and text vectors land in the same space, enabling cross-modal
 * search. See docs/features/embeddings.md.
 */
export class JointEmbedder {
  /**
   * @param {string} modelName             Hugging Face model identifier
   * @param {object} [options]
   * @param {string} [options.mode]        'process' | 'thread' | 'socket' | 'grpc' (default: 'process')
   * @param {string} [options.device]      'cpu' | 'gpu' | 'auto' (default: 'cpu')
   * @param {string} [options.provider]    'cpu' | 'cuda' | 'dml'
   * @param {number} [options.batchSize]   Images/texts per worker task (default: 32)
   * @param {number} [options.concurrency] Parallel workers (default: 2)
   * @param {string} [options.cacheDir]    Model cache directory (default: ~/.seedeer/models)
   * @returns {Promise<JointEmbedder>}
   */
  static async create(modelName, options = {}) {
    throw new NotImplementedError('JointEmbedder', 'Phase 1 (see docs/ROADMAP.md)');
  }

  /**
   * @param {Array<string|Buffer>} images  File paths or image buffers
   * @returns {Promise<number[][]>}
   */
  async embedImages(images) {
    throw new NotImplementedError('JointEmbedder.embedImages', 'Phase 1 (see docs/ROADMAP.md)');
  }

  /**
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedText(texts) {
    throw new NotImplementedError('JointEmbedder.embedText', 'Phase 1 (see docs/ROADMAP.md)');
  }

  async destroy() {
    throw new NotImplementedError('JointEmbedder.destroy', 'Phase 1 (see docs/ROADMAP.md)');
  }
}
