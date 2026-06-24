#!/usr/bin/env node

const HELP = `
seedeer — vision-model toolkit (scaffold, no models wired up yet)

Usage:
  seedeer --help

This is Phase 0 of docs/ROADMAP.md: package structure and public API
shapes are in place, but no pillar (embeddings, captioning, VQA,
detection/tracking) has a working model yet. See docs/ROADMAP.md for the
implementation phases and docs/features/ for each pillar's target CLI/API.
`;

const args = process.argv.slice(2);

if (args.includes('--help') || args.length === 0) {
  process.stdout.write(HELP);
  process.exit(0);
}

process.stderr.write(`Unknown or not-yet-implemented command: ${args.join(' ')}\n${HELP}`);
process.exit(1);
