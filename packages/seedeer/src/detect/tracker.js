import { NotImplementedError } from '../errors.js';

/**
 * Assigns persistent IDs to detections across frames. Starts as a simple
 * IOU-based tracker; a ByteTrack-class upgrade is only justified if the
 * ID-switch rate under occlusion proves too high in practice. See
 * docs/features/detection-tracking.md.
 */
export class Tracker {
  constructor(options = {}) {
    throw new NotImplementedError('Tracker', 'Phase 4 (see docs/ROADMAP.md)');
  }

  /**
   * Feed one frame's detections and get back the same boxes annotated with
   * persistent track IDs.
   *
   * @param {Array<{ x: number, y: number, width: number, height: number, score: number }>} detections
   * @returns {Array<{ trackId: number, x: number, y: number, width: number, height: number, score: number }>}
   */
  update(detections) {
    throw new NotImplementedError('Tracker.update', 'Phase 4 (see docs/ROADMAP.md)');
  }
}
