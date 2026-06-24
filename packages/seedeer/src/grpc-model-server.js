#!/usr/bin/env node
import { NotImplementedError } from './errors.js';

/**
 * gRPC server entry point — exposes a pillar's model as a typed HTTP/2
 * service, local or remote (e.g. a GPU box spun up on demand), mirroring
 * embedeer's grpc-model-server. Not implemented yet; planned alongside
 * each pillar's 'grpc' mode. See docs/ROADMAP.md.
 */
function main() {
  throw new NotImplementedError('grpc-model-server', 'each pillar phase, see docs/ROADMAP.md');
}

main();
