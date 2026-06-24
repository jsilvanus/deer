import { NotImplementedError } from '../../errors.js';

/**
 * Remote VQA backend — delegates to an already-running OpenAI-compatible
 * vision endpoint (e.g. Ollama serving qwen2-vl/llava, or vLLM).
 *
 * This is the only place in seedeer that speaks OpenAI-compatible HTTP on
 * the wire, and it does so internally: callers still only ever call
 * `ask(image, question)`, never construct a URL or call fetch() themselves.
 * Mirrors chattydeer's provider adapter intentionally — see
 * docs/features/vqa.md.
 */
export class RemoteVqaBackend {
  /**
   * @param {object} options
   * @param {string} options.endpoint   Base URL of the OpenAI-compatible endpoint
   * @param {string} options.model      Model name as served by the endpoint
   * @param {string} [options.apiKey]   API key, if required by the endpoint
   */
  static async create(options) {
    throw new NotImplementedError('RemoteVqaBackend', 'Phase 3 (see docs/ROADMAP.md)');
  }

  /**
   * @param {string|Buffer} image
   * @param {string} question
   * @returns {Promise<string>}
   * @throws  Clear, distinguishable error if the endpoint is unreachable —
   *          does not silently fall back to a local backend.
   */
  async ask(image, question) {
    throw new NotImplementedError('RemoteVqaBackend.ask', 'Phase 3 (see docs/ROADMAP.md)');
  }

  async destroy() {
    throw new NotImplementedError('RemoteVqaBackend.destroy', 'Phase 3 (see docs/ROADMAP.md)');
  }
}
