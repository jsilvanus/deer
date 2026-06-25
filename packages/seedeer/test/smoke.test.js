import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JointEmbedder,
  VisualEmbedder,
  Captioner,
  VqaAssistant,
  Detector,
  Tracker,
  ZoneTrigger,
  TrackingSession,
} from '../src/index.js';

test('public API surface is exported', () => {
  assert.equal(typeof JointEmbedder.create, 'function');
  assert.equal(typeof VisualEmbedder.create, 'function');
  assert.equal(typeof Captioner.create, 'function');
  assert.equal(typeof VqaAssistant.create, 'function');
  assert.equal(typeof Detector.create, 'function');
  assert.equal(typeof Tracker, 'function');
  assert.equal(typeof ZoneTrigger, 'function');
  assert.equal(typeof TrackingSession.create, 'function');
});

test('VqaAssistant validates backend option before reporting not-implemented', async () => {
  await assert.rejects(() => VqaAssistant.create({ backend: 'bogus' }), /Unknown VQA backend/);
});
