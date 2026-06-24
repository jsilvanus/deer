import { NotImplementedError } from '../errors.js';

/**
 * Vision-only embedder (DINOv2-class models). Not comparable to text
 * embeddings — for image-to-image similarity, clustering, and
 * near-duplicate detection. See docs/features/embeddings.md.
 */
export class VisualEmbedder {
  /**
   * @param {string} modelName             Hugging Face model identifier
   * @param {object} [options]             Same shape as JointEmbedder options
   * @returns {Promise<VisualEmbedder>}
   */
  static async create(modelName, options = {}) {
    throw new NotImplementedError('VisualEmbedder', 'Phase 1 (see docs/ROADMAP.md)');
  }

  /**
   * @param {Array<string|Buffer>} images  File paths or image buffers
   * @returns {Promise<number[][]>}
   */
  async embedImages(images) {
    throw new NotImplementedError('VisualEmbedder.embedImages', 'Phase 1 (see docs/ROADMAP.md)');
  }

  async destroy() {
    throw new NotImplementedError('VisualEmbedder.destroy', 'Phase 1 (see docs/ROADMAP.md)');
  }
}
