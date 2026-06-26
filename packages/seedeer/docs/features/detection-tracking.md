# Feature spec — Detect + Track + Zone-trigger

## Goal

Real-time computer-vision pipeline for production-assistant use cases:
detect people in a video frame, track them as persistent identities across
frames, and emit events when a tracked person enters/exits a named region
of the frame (e.g. "track #3 entered zone B" → caller decides what to do,
such as switching a camera).

This pillar is explicitly **not** about image redaction — bounding boxes
here are positional signals for triggering external actions, not regions to
blur. (Clarified during planning: redaction was an earlier hypothesis,
replaced once the actual use case — live production assistance — was
established.)

## Why this pillar has a different API shape

Every other pillar in seedeer is request/response: one image (or batch) in,
one result out, no state retained between calls. This pillar is a
**stream**: frames arrive continuously from a camera source, and the
answer to "did someone enter zone B" cannot be derived from any single
frame in isolation — it requires:

1. Per-frame detection (bounding boxes) — fast, stateless on its own.
2. Cross-frame tracking — assigning a persistent ID to "the same person"
   across frames, because per-frame detection alone flickers (a person can
   drop out for a frame, boxes jitter) and re-discovering people from
   scratch every frame can't answer "did they move," only "are they here
   now."
3. Zone evaluation against tracked positions, not raw per-frame boxes —
   firing an event on ID transition (track was outside zone, now inside),
   not on every frame a box happens to overlap the zone.

So the public API is session-shaped (open once, subscribe to events) rather
than call-and-return.

## Public API (target shape, Phase 4)

```js
import { TrackingSession } from '@jsilvanus/seedeer';

const session = await TrackingSession.create({
  detector: { model: 'onnx-community/rtdetr_r18vd', mode: 'process', device: 'auto' }, // default if omitted
  // mode may also be 'grpc' pointed at a remote server — symmetry with
  // every other pillar — but 'process'/'thread' is the latency-sane default.
  zones: [
    { id: 'zoneB', polygon: [[x1, y1], [x2, y2], [x3, y3], [x4, y4]] },
  ],
});

session.on('zoneEnter', ({ trackId, zoneId, frame }) => { /* ... */ });
session.on('zoneExit',  ({ trackId, zoneId, frame }) => { /* ... */ });

await session.pushFrame(frameBufferOrTensor);   // caller owns frame capture
// or: await session.attachStream(videoSource)   // if a stream source is provided

await session.destroy();
```

seedeer does not capture video itself — frame acquisition (from a camera,
capture card, or production tool) is the caller's responsibility. seedeer
consumes frames and produces detection/tracking/zone events.

## Behavioral requirements

- Detector: per-frame bounding boxes for people, fast enough for
  frame-rate use (target: tens of FPS on CPU, well over 100 FPS on GPU,
  using a YOLO-nano-class ONNX model — to be benchmarked once implemented).
- Tracker: persistent ID assignment across frames. Start with a simple
  IOU-based tracker; revisit a ByteTrack-class approach only if ID-switch
  rate under occlusion proves too high in practice.
- ZoneTrigger: zone definitions are rectangles or polygons in frame
  coordinates; events fire on state transition (enter/exit) keyed by track
  ID, never on raw per-frame overlap.
- This pillar must support `mode: 'process'`/`'thread'` (local, default)
  **and** `mode: 'grpc'` (remote, for symmetry with every other pillar, per
  explicit planning decision) even though local is the latency-sane
  default.
- No coupling to any specific downstream consumer (e.g. a production
  switcher). This module emits events; what a listener does with them is
  entirely the caller's concern.

## Out of scope for this feature

- Face detection / identity recognition (this is position tracking, not
  identification)
- Image redaction or pixel mutation
- Camera control of any kind (zone events are emitted; acting on them is
  the caller's job)
