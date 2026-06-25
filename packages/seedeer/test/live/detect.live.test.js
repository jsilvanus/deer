// Live tests download real models from the Hugging Face Hub and run real
// inference. They're excluded from `npm test` (test/*.test.js) and run via
// `npm run test:live`, since they're slow and need network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Detector, TrackingSession } from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAT_IMAGE = path.join(__dirname, '..', 'fixtures', 'cats.jpg');

test('Detector: finds the known "cat" boxes in the fixture image (label filter off)', async () => {
  const detector = await Detector.create({ mode: 'process', concurrency: 1, label: null });
  try {
    const boxes = await detector.detect(CAT_IMAGE);
    assert.ok(boxes.length > 0);
    for (const box of boxes) {
      assert.equal(typeof box.x, 'number');
      assert.equal(typeof box.y, 'number');
      assert.equal(typeof box.width, 'number');
      assert.equal(typeof box.height, 'number');
      assert.equal(typeof box.score, 'number');
    }
  } finally {
    await detector.destroy();
  }
});

test('Detector: label filter narrows results (no people in the cats fixture)', async () => {
  const detector = await Detector.create({ mode: 'process', concurrency: 1 }); // default label: 'person'
  try {
    const boxes = await detector.detect(CAT_IMAGE);
    assert.deepEqual(boxes, []);
  } finally {
    await detector.destroy();
  }
});

test('TrackingSession: pushFrame runs detect -> track -> zone-evaluate without throwing', async () => {
  const session = await TrackingSession.create({
    detector: { mode: 'process', concurrency: 1, label: null },
    zones: [{ id: 'wholeFrame', rect: { x: 0, y: 0, width: 1000, height: 1000 } }],
  });
  const zoneEnters = [];
  session.on('zoneEnter', (event) => zoneEnters.push(event));
  try {
    await session.pushFrame(CAT_IMAGE);
    assert.ok(zoneEnters.length > 0);
    assert.equal(zoneEnters[0].zoneId, 'wholeFrame');
  } finally {
    await session.destroy();
  }
});
