/**
 * Assigns persistent IDs to detections across frames via a simple
 * IOU-matching tracker; a ByteTrack-class upgrade is only justified if the
 * ID-switch rate under occlusion proves too high in practice. See
 * docs/features/detection-tracking.md.
 */
export class Tracker {
  #tracks = new Map();
  #nextId = 1;
  #iouThreshold;
  #maxMissedFrames;

  /**
   * @param {object} [options]
   * @param {number} [options.iouThreshold]     Minimum IOU to match a detection to an existing track (default: 0.3)
   * @param {number} [options.maxMissedFrames]  Frames a track may go undetected before it's dropped (default: 5)
   */
  constructor(options = {}) {
    this.#iouThreshold = options.iouThreshold ?? 0.3;
    this.#maxMissedFrames = options.maxMissedFrames ?? 5;
  }

  /**
   * Feed one frame's detections and get back the same boxes annotated with
   * persistent track IDs.
   *
   * @param {Array<{ x: number, y: number, width: number, height: number, score: number }>} detections
   * @returns {Array<{ trackId: number, x: number, y: number, width: number, height: number, score: number }>}
   */
  update(detections) {
    const unmatchedTrackIds = new Set(this.#tracks.keys());
    const results = [];

    for (const detection of detections) {
      let bestTrackId = null;
      let bestIou = 0;
      for (const trackId of unmatchedTrackIds) {
        const iou = boxIou(this.#tracks.get(trackId).box, detection);
        if (iou > bestIou) {
          bestIou = iou;
          bestTrackId = trackId;
        }
      }

      let trackId;
      if (bestTrackId !== null && bestIou >= this.#iouThreshold) {
        trackId = bestTrackId;
        unmatchedTrackIds.delete(trackId);
      } else {
        trackId = this.#nextId++;
      }

      this.#tracks.set(trackId, { box: detection, missedFrames: 0 });
      results.push({ trackId, ...detection });
    }

    for (const trackId of unmatchedTrackIds) {
      const track = this.#tracks.get(trackId);
      track.missedFrames += 1;
      if (track.missedFrames > this.#maxMissedFrames) {
        this.#tracks.delete(trackId);
      }
    }

    return results;
  }
}

function boxIou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union <= 0 ? 0 : intersection / union;
}
