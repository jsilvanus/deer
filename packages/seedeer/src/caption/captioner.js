import { NotImplementedError } from '../errors.js';

/**
 * Generic image captioning (BLIP-class models). Fixed-style descriptions,
 * not question-driven — see VqaAssistant for that. See
 * docs/features/captioning.md.
 */
export class Captioner {
  /**
   * @param {string} modelName          Hugging Face model identifier
   * @param {object} [options]
   * @param {string} [options.mode]     'process' | 'thread' | 'socket' | 'grpc' (default: 'process')
   * @param {string} [options.device]   'cpu' | 'gpu' | 'auto' (default: 'cpu')
   * @param {string} [options.provider] 'cpu' | 'cuda' | 'dml'
   * @returns {Promise<Captioner>}
   */
  static async create(modelName, options = {}) {
    throw new NotImplementedError('Captioner', 'Phase 2 (see docs/ROADMAP.md)');
  }

  /**
   * @param {Array<string|Buffer>} images  File paths or image buffers
   * @returns {Promise<string[]>}          One caption per input image
   */
  async caption(images) {
    throw new NotImplementedError('Captioner.caption', 'Phase 2 (see docs/ROADMAP.md)');
  }

  async destroy() {
    throw new NotImplementedError('Captioner.destroy', 'Phase 2 (see docs/ROADMAP.md)');
  }
}
