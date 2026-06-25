import test from 'node:test';
import assert from 'node:assert/strict';
import { Tracker, ZoneTrigger } from '../src/index.js';

test('Tracker: assigns a stable ID to a slowly moving box', () => {
  const tracker = new Tracker();
  const [a] = tracker.update([{ x: 10, y: 10, width: 50, height: 50, score: 0.9 }]);
  const [b] = tracker.update([{ x: 14, y: 12, width: 50, height: 50, score: 0.9 }]);
  assert.equal(a.trackId, b.trackId);
});

test('Tracker: assigns distinct IDs to non-overlapping boxes', () => {
  const tracker = new Tracker();
  const [a] = tracker.update([{ x: 0, y: 0, width: 10, height: 10, score: 0.9 }]);
  const [b] = tracker.update([{ x: 500, y: 500, width: 10, height: 10, score: 0.9 }]);
  assert.notEqual(a.trackId, b.trackId);
});

test('Tracker: keeps a track alive across a brief miss, drops it after maxMissedFrames', () => {
  const tracker = new Tracker({ maxMissedFrames: 1 });
  const [a] = tracker.update([{ x: 10, y: 10, width: 50, height: 50, score: 0.9 }]);
  tracker.update([]); // missed once, still alive
  const [b] = tracker.update([{ x: 12, y: 11, width: 50, height: 50, score: 0.9 }]);
  assert.equal(a.trackId, b.trackId);

  tracker.update([]); // missed frame 1
  tracker.update([]); // missed frame 2 -> dropped
  const [c] = tracker.update([{ x: 12, y: 11, width: 50, height: 50, score: 0.9 }]);
  assert.notEqual(b.trackId, c.trackId);
});

test('ZoneTrigger: fires zoneEnter then zoneExit on a rect zone as a box crosses it', () => {
  const zone = new ZoneTrigger([{ id: 'zoneA', rect: { x: 0, y: 0, width: 100, height: 100 } }]);

  const outside = zone.evaluate([{ trackId: 1, x: 200, y: 200, width: 10, height: 10 }]);
  assert.deepEqual(outside, []);

  const entered = zone.evaluate([{ trackId: 1, x: 40, y: 40, width: 10, height: 10 }]);
  assert.deepEqual(entered, [{ type: 'zoneEnter', trackId: 1, zoneId: 'zoneA' }]);

  const staying = zone.evaluate([{ trackId: 1, x: 45, y: 45, width: 10, height: 10 }]);
  assert.deepEqual(staying, []);

  const exited = zone.evaluate([{ trackId: 1, x: 300, y: 300, width: 10, height: 10 }]);
  assert.deepEqual(exited, [{ type: 'zoneExit', trackId: 1, zoneId: 'zoneA' }]);
});

test('ZoneTrigger: supports polygon zones', () => {
  const zone = new ZoneTrigger([
    { id: 'tri', polygon: [[0, 0], [100, 0], [50, 100]] },
  ]);

  const inside = zone.evaluate([{ trackId: 1, x: 45, y: 10, width: 10, height: 10 }]);
  assert.deepEqual(inside, [{ type: 'zoneEnter', trackId: 1, zoneId: 'tri' }]);
});
