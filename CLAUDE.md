# CLAUDE.md

This is a pnpm workspace monorepo with four packages under `packages/`:

- `packages/nudeer` — `@jsilvanus/nudeer` (generic worker pool and model server infrastructure)
- `packages/seedeer` — `@jsilvanus/seedeer` (vision-model toolkit; depends on `@jsilvanus/nudeer` via `workspace:*`)
- `packages/embedeer` — `@jsilvanus/embedeer` (text embedding tool)
- `packages/chattydeer` — `@jsilvanus/chattydeer` (LLM chat completions; depends on `@jsilvanus/embedeer` via `workspace:*`)

Each package has its own `CLAUDE.md` with package-specific architecture, commands, and conventions:

- [`packages/nudeer/CLAUDE.md`](packages/nudeer/CLAUDE.md)
- [`packages/embedeer/CLAUDE.md`](packages/embedeer/CLAUDE.md)
- [`packages/chattydeer/CLAUDE.md`](packages/chattydeer/CLAUDE.md)

Read the relevant package's `CLAUDE.md` before working inside that package's directory.

## Commands

```bash
# Install dependencies for the whole workspace
pnpm install

# Build / test / lint all packages
pnpm run build
pnpm test
pnpm run lint

# Scope to a single package
pnpm --filter @jsilvanus/<name> <script>
```

## Releases (Changesets)

Versioning, changelogs, and publishing for all four packages are automated via [Changesets](https://github.com/changesets/changesets) and `.github/workflows/release.yml`, from a single root `.changeset/` directory (not per-package).

1. When making a user-facing change to any package, run `pnpm changeset` and describe the change (patch/minor/major). Commit the generated `.changeset/*.md` file with your PR.
   - **Agent convention:** when an agent opens a PR with a user-facing change, it should create the changeset file itself (writing `.changeset/*.md` directly with an appropriate bump type and summary, rather than running the interactive `pnpm changeset` command) and include it in the PR, then explicitly tell the user it added a changeset and what bump type it chose.
2. On merge to `main`, the release workflow installs deps, builds, and runs `pnpm test`. If they pass and there are pending changesets, it opens/updates a "Version Packages" PR that bumps each affected package's `package.json`, updates its `CHANGELOG.md`, and consumes the changeset files.
3. Merging the "Version Packages" PR triggers the release workflow again; with no pending changesets and a version bump present, it runs `pnpm changeset publish` to publish the affected package(s) to npm.
4. Publishing uses npm's OIDC **Trusted Publishing** — no `NPM_TOKEN` secret is stored. Each published npm package (`@jsilvanus/nudeer`, `@jsilvanus/embedeer`, `@jsilvanus/chattydeer`, `@jsilvanus/seedeer`) must have this repo's `release.yml` workflow registered as a Trusted Publisher (npmjs.com → package → Settings → Trusted Publisher). Packages previously published from the standalone `embedeer`/`chattydeer`/`seedeer` repos need this binding repointed to `jsilvanus/deer` before the first post-migration release.

**Do not run `npm version`, `pnpm version`, or manually edit the `version` field in any package's `package.json`.** Do not run `npm publish` / `pnpm publish` locally either. The only manual step for a contributor is `pnpm changeset`.

Packages version independently (no `fixed`/`linked` grouping in `.changeset/config.json`) — bumping one package does not force a version bump in the others, except where `updateInternalDependencies: "patch"` bumps `chattydeer` when its `workspace:*` dependency on `embedeer` changes.
