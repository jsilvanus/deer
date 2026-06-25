import { LocalVqaBackend } from './backends/local-backend.js';
import { RemoteVqaBackend } from './backends/remote-backend.js';

/**
 * Visual question answering with a pluggable backend. See
 * docs/features/vqa.md.
 */
export class VqaAssistant {
  #backend;

  constructor(backend) {
    this.#backend = backend;
  }

  /**
   * @param {object} options
   * @param {'local'|'remote'} [options.backend]  Default: 'local'
   * @param {string} [options.model]              Model identifier (local) or model name (remote)
   * @param {string} [options.endpoint]           Required when backend === 'remote'
   * @param {string} [options.apiKey]             API key, for backend === 'remote'
   * @param {string} [options.mode]               'process' | 'thread' | 'socket' | 'grpc' (local backend only)
   * @param {string} [options.device]             'cpu' | 'gpu' | 'auto' (local backend only)
   * @returns {Promise<VqaAssistant>}
   */
  static async create(options = {}) {
    const backendKind = options.backend ?? 'local';
    if (backendKind !== 'local' && backendKind !== 'remote') {
      throw new Error(`Unknown VQA backend "${backendKind}". Expected "local" or "remote".`);
    }
    const backend =
      backendKind === 'local'
        ? await LocalVqaBackend.create(options)
        : await RemoteVqaBackend.create(options);
    return new VqaAssistant(backend);
  }

  /**
   * @param {string|Buffer} image
   * @param {string} question
   * @returns {Promise<string>}
   */
  async ask(image, question) {
    return this.#backend.ask(image, question);
  }

  async destroy() {
    await this.#backend.destroy();
  }
}

// Re-exported so advanced callers can use a backend directly without going
// through VqaAssistant's dispatch, if ever needed.
export { LocalVqaBackend, RemoteVqaBackend };
