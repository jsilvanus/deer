# deer

A pnpm workspace monorepo for the deer family of Node.js packages:

- [`packages/seedeer`](packages/seedeer) — [`@jsilvanus/seedeer`](packages/seedeer/README.md): vision-model toolkit (detection/tracking, VQA, captioning, image embeddings).
- [`packages/embedeer`](packages/embedeer) — [`@jsilvanus/embedeer`](packages/embedeer/README.md): Node.js text embedding tool with optional GPU acceleration.
- [`packages/chattydeer`](packages/chattydeer) — [`@jsilvanus/chattydeer`](packages/chattydeer/README.md): LLM chat completions, deterministic explanations, and agentic tool-calling, built on `embedeer`.

## Getting started

```bash
pnpm install
pnpm run build
pnpm test
pnpm run lint
```

Run commands for a single package with `pnpm --filter`:

```bash
pnpm --filter @jsilvanus/embedeer test
pnpm --filter @jsilvanus/chattydeer build
```

## Releases

Versioning and publishing for all three packages are handled by [Changesets](https://github.com/changesets/changesets) from a single root `.changeset/` directory. See [CLAUDE.md](CLAUDE.md) for the full release process.
