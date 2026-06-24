import { EventEmitter } from 'node:events';
import { NotImplementedError } from '../errors.js';

/**
 * Session-shaped API tying Detector + Tracker + ZoneTrigger together:
 * push frames in, subscribe to zoneEnter/zoneExit events. seedeer does not
 * capture video itself — frame acquisition is the caller's responsibility.
 * See docs/features/detection-tracking.md for why this pillar is
 * session-shaped rather than call/return like the others.
 */
export class TrackingSession extends EventEmitter {
  /**
   * @param {object} options
   * @param {object} options.detector                    Detector.create() options
   * @param {Array<{ id: string, polygon: Array<[number, number]> }>} options.zones
   * @returns {Promise<TrackingSession>}
   */
  static async create(options = {}) {
    throw new NotImplementedError('TrackingSession', 'Phase 4 (see docs/ROADMAP.md)');
  }

  /**
   * @param {Buffer} frame  A single decoded video frame
   * @returns {Promise<void>}  Emits 'zoneEnter'/'zoneExit' as a side effect
   */
  async pushFrame(frame) {
    throw new NotImplementedError('TrackingSession.pushFrame', 'Phase 4 (see docs/ROADMAP.md)');
  }

  async destroy() {
    throw new NotImplementedError('TrackingSession.destroy', 'Phase 4 (see docs/ROADMAP.md)');
  }
}
