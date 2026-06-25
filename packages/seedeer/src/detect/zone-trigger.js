/**
 * Named regions (rect/polygon) evaluated against tracked positions. Fires
 * on state transition (enter/exit) keyed by track ID, never on raw
 * per-frame overlap. Containment is tested against each box's center
 * point. See docs/features/detection-tracking.md.
 */
export class ZoneTrigger {
  #zones;
  #stateByTrackId = new Map();

  /**
   * @param {Array<{ id: string, polygon?: Array<[number, number]>, rect?: { x: number, y: number, width: number, height: number } }>} zones
   */
  constructor(zones = []) {
    this.#zones = zones.map((zone) => ({
      id: zone.id,
      polygon: zone.polygon ?? rectToPolygon(zone.rect),
    }));
  }

  /**
   * Feed one frame's tracked boxes and get back zone enter/exit events
   * generated since the previous call.
   *
   * @param {Array<{ trackId: number, x: number, y: number, width: number, height: number }>} trackedBoxes
   * @returns {Array<{ type: 'zoneEnter'|'zoneExit', trackId: number, zoneId: string }>}
   */
  evaluate(trackedBoxes) {
    const events = [];

    for (const box of trackedBoxes) {
      const center = [box.x + box.width / 2, box.y + box.height / 2];
      const previousZoneIds = this.#stateByTrackId.get(box.trackId) ?? new Set();
      const currentZoneIds = new Set();

      for (const zone of this.#zones) {
        if (pointInPolygon(center, zone.polygon)) {
          currentZoneIds.add(zone.id);
          if (!previousZoneIds.has(zone.id)) {
            events.push({ type: 'zoneEnter', trackId: box.trackId, zoneId: zone.id });
          }
        }
      }

      for (const zoneId of previousZoneIds) {
        if (!currentZoneIds.has(zoneId)) {
          events.push({ type: 'zoneExit', trackId: box.trackId, zoneId });
        }
      }

      this.#stateByTrackId.set(box.trackId, currentZoneIds);
    }

    return events;
  }
}

function rectToPolygon(rect) {
  if (!rect) {
    throw new Error('Zone must specify either "polygon" or "rect".');
  }
  const { x, y, width, height } = rect;
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

function pointInPolygon([px, py], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
