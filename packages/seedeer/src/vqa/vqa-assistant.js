import { NotImplementedError } from '../errors.js';
import { LocalVqaBackend } from './backends/local-backend.js';
import { RemoteVqaBackend } from './backends/remote-backend.js';

/**
 * Visual question answering with a pluggable backend. See
 * docs/features/vqa.md.
 */
export class VqaAssistant {
  /**
   * @param {object} options
   * @param {'local'|'remote'} [options.backend]  Default: 'local'
   * @param {string} [options.model]              Model identifier (local) or model name (remote)
   * @param {string} [options.endpoint]           Required when backend === 'remote'
   * @param {string} [options.mode]               'process' | 'thread' | 'socket' | 'grpc' (local backend only)
   * @param {string} [options.device]             'cpu' | 'gpu' | 'auto' (local backend only)
   * @returns {Promise<VqaAssistant>}
   */
  static async create(options = {}) {
    const backend = options.backend ?? 'local';
    if (backend !== 'local' && backend !== 'remote') {
      throw new Error(`Unknown VQA backend "${backend}". Expected "local" or "remote".`);
    }
    throw new NotImplementedError('VqaAssistant', 'Phase 3 (see docs/ROADMAP.md)');
  }

  /**
   * @param {string|Buffer} image
   * @param {string} question
   * @returns {Promise<string>}
   */
  async ask(image, question) {
    throw new NotImplementedError('VqaAssistant.ask', 'Phase 3 (see docs/ROADMAP.md)');
  }

  async destroy() {
    throw new NotImplementedError('VqaAssistant.destroy', 'Phase 3 (see docs/ROADMAP.md)');
  }
}

// Re-exported so advanced callers can use a backend directly without going
// through VqaAssistant's dispatch, if ever needed.
export { LocalVqaBackend, RemoteVqaBackend };
