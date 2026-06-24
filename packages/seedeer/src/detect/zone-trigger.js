import { NotImplementedError } from '../errors.js';

/**
 * Named regions (rect/polygon) evaluated against tracked positions. Fires
 * on state transition (enter/exit) keyed by track ID, never on raw
 * per-frame overlap. See docs/features/detection-tracking.md.
 */
export class ZoneTrigger {
  /**
   * @param {Array<{ id: string, polygon: Array<[number, number]> }>} zones
   */
  constructor(zones = []) {
    throw new NotImplementedError('ZoneTrigger', 'Phase 4 (see docs/ROADMAP.md)');
  }

  /**
   * Feed one frame's tracked boxes and get back zone enter/exit events
   * generated since the previous call.
   *
   * @param {Array<{ trackId: number, x: number, y: number, width: number, height: number }>} trackedBoxes
   * @returns {Array<{ type: 'zoneEnter'|'zoneExit', trackId: number, zoneId: string }>}
   */
  evaluate(trackedBoxes) {
    throw new NotImplementedError('ZoneTrigger.evaluate', 'Phase 4 (see docs/ROADMAP.md)');
  }
}
