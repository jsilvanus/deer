import { EventEmitter } from 'node:events';
import { Detector } from './detector.js';
import { Tracker } from './tracker.js';
import { ZoneTrigger } from './zone-trigger.js';

/**
 * Session-shaped API tying Detector + Tracker + ZoneTrigger together:
 * push frames in, subscribe to zoneEnter/zoneExit events. seedeer does not
 * capture video itself — frame acquisition is the caller's responsibility.
 * See docs/features/detection-tracking.md for why this pillar is
 * session-shaped rather than call/return like the others.
 */
export class TrackingSession extends EventEmitter {
  #detector;
  #tracker;
  #zoneTrigger;

  constructor(detector, tracker, zoneTrigger) {
    super();
    this.#detector = detector;
    this.#tracker = tracker;
    this.#zoneTrigger = zoneTrigger;
  }

  /**
   * @param {object} options
   * @param {object} [options.detector]                   Detector.create() options
   * @param {object} [options.tracker]                     Tracker constructor options
   * @param {Array<{ id: string, polygon?: Array<[number, number]>, rect?: object }>} [options.zones]
   * @returns {Promise<TrackingSession>}
   */
  static async create(options = {}) {
    const detector = await Detector.create(options.detector);
    const tracker = new Tracker(options.tracker);
    const zoneTrigger = new ZoneTrigger(options.zones ?? []);
    return new TrackingSession(detector, tracker, zoneTrigger);
  }

  /**
   * @param {Buffer|string} frame  A single decoded video frame
   * @returns {Promise<void>}  Emits 'zoneEnter'/'zoneExit' as a side effect
   */
  async pushFrame(frame) {
    const detections = await this.#detector.detect(frame);
    const trackedBoxes = this.#tracker.update(detections);
    const events = this.#zoneTrigger.evaluate(trackedBoxes);
    for (const event of events) {
      this.emit(event.type, { ...event, frame });
    }
  }

  async destroy() {
    await this.#detector.destroy();
  }
}
