import { NotImplementedError } from '../../errors.js';

/**
 * In-process VQA backend (small VLM run locally via transformers.js/ONNX).
 * Implements the same `ask(image, question)` interface as the remote
 * backend — see docs/features/vqa.md.
 */
export class LocalVqaBackend {
  /**
   * @param {object} [options]
   * @param {string} [options.model]    Hugging Face model identifier
   * @param {string} [options.mode]     'process' | 'thread' | 'socket' | 'grpc'
   * @param {string} [options.device]   'cpu' | 'gpu' | 'auto'
   * @param {string} [options.provider] 'cpu' | 'cuda' | 'dml'
   */
  static async create(options = {}) {
    throw new NotImplementedError('LocalVqaBackend', 'Phase 3 (see docs/ROADMAP.md)');
  }

  /**
   * @param {string|Buffer} image
   * @param {string} question
   * @returns {Promise<string>}
   */
  async ask(image, question) {
    throw new NotImplementedError('LocalVqaBackend.ask', 'Phase 3 (see docs/ROADMAP.md)');
  }

  async destroy() {
    throw new NotImplementedError('LocalVqaBackend.destroy', 'Phase 3 (see docs/ROADMAP.md)');
  }
}
