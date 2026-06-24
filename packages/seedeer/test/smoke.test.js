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
  NotImplementedError,
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

test('unimplemented pillars fail loudly, not silently', async () => {
  await assert.rejects(() => JointEmbedder.create('any-model'), NotImplementedError);
  await assert.rejects(() => VisualEmbedder.create('any-model'), NotImplementedError);
  await assert.rejects(() => Captioner.create('any-model'), NotImplementedError);
  await assert.rejects(() => Detector.create(), NotImplementedError);
  await assert.rejects(() => TrackingSession.create({}), NotImplementedError);
});

test('VqaAssistant validates backend option before reporting not-implemented', async () => {
  await assert.rejects(() => VqaAssistant.create({ backend: 'bogus' }), /Unknown VQA backend/);
});
