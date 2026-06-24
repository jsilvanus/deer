#!/usr/bin/env node
import { NotImplementedError } from './errors.js';

/**
 * Socket daemon entry point — one persistent model server shared across
 * OS processes on the same host, mirroring embedeer's socket-model-server.
 * Not implemented yet; planned alongside each pillar's 'socket' mode.
 * See docs/ROADMAP.md.
 */
function main() {
  throw new NotImplementedError('socket-model-server', 'each pillar phase, see docs/ROADMAP.md');
}

main();
