import fs from 'node:fs/promises';

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
  #endpoint;
  #model;
  #apiKey;

  constructor({ endpoint, model, apiKey }) {
    this.#endpoint = endpoint;
    this.#model = model;
    this.#apiKey = apiKey;
  }

  /**
   * @param {object} options
   * @param {string} options.endpoint   Base URL of the OpenAI-compatible endpoint
   * @param {string} options.model      Model name as served by the endpoint
   * @param {string} [options.apiKey]   API key, if required by the endpoint
   */
  static async create(options) {
    const { endpoint, model, apiKey } = options ?? {};
    if (!endpoint) {
      throw new Error('RemoteVqaBackend requires options.endpoint.');
    }
    if (!model) {
      throw new Error('RemoteVqaBackend requires options.model.');
    }
    return new RemoteVqaBackend({ endpoint, model, apiKey });
  }

  /**
   * @param {string|Buffer} image
   * @param {string} question
   * @returns {Promise<string>}
   * @throws  Clear, distinguishable error if the endpoint is unreachable —
   *          does not silently fall back to a local backend.
   */
  async ask(image, question) {
    const imageUrl = await toDataUrl(image);
    const url = `${this.#endpoint.replace(/\/$/, '')}/chat/completions`;

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.#apiKey ? { Authorization: `Bearer ${this.#apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.#model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: question },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
        }),
      });
    } catch (cause) {
      throw new Error(`RemoteVqaBackend: failed to reach endpoint "${url}": ${cause.message}`, {
        cause,
      });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `RemoteVqaBackend: endpoint "${url}" responded with ${response.status} ${response.statusText}: ${body}`,
      );
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string') {
      throw new Error(`RemoteVqaBackend: unexpected response shape from "${url}".`);
    }
    return answer.trim();
  }

  async destroy() {
    // No persistent resources — nothing to clean up.
  }
}

async function toDataUrl(image) {
  if (typeof image === 'string' && /^(https?|data):/.test(image)) {
    return image;
  }
  const buffer = Buffer.isBuffer(image) ? image : await fs.readFile(image);
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}
