import { NotImplementedError } from '../errors.js';

/**
 * Per-frame person detection (YOLO-nano-class ONNX model). Fast, stateless
 * on its own — see TrackingSession for the stateful pipeline built on top.
 * See docs/features/detection-tracking.md.
 */
export class Detector {
  /**
   * @param {object} [options]
   * @param {string} [options.model]    Model identifier
   * @param {string} [options.mode]     'process' | 'thread' | 'grpc' (default: 'process')
   * @param {string} [options.device]   'cpu' | 'gpu' | 'auto' (default: 'cpu')
   * @param {string} [options.provider] 'cpu' | 'cuda' | 'dml'
   * @returns {Promise<Detector>}
   */
  static async create(options = {}) {
    throw new NotImplementedError('Detector', 'Phase 4 (see docs/ROADMAP.md)');
  }

  /**
   * @param {Buffer} frame  A single decoded video frame
   * @returns {Promise<Array<{ x: number, y: number, width: number, height: number, score: number }>>}
   */
  async detect(frame) {
    throw new NotImplementedError('Detector.detect', 'Phase 4 (see docs/ROADMAP.md)');
  }

  async destroy() {
    throw new NotImplementedError('Detector.destroy', 'Phase 4 (see docs/ROADMAP.md)');
  }
}
