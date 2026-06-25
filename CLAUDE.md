# CLAUDE.md

This is a pnpm workspace monorepo with four packages under `packages/`:

- `packages/nudeer` — `@jsilvanus/nudeer` (generic worker pool and model server infrastructure)
- `packages/seedeer` — `@jsilvanus/seedeer` (vision-model toolkit; depends on `@jsilvanus/nudeer` via `workspace:*`)
- `packages/embedeer` — `@jsilvanus/embedeer` (text embedding tool)
- `packages/chattydeer` — `@jsilvanus/chattydeer` (LLM chat completions; depends on `@jsilvanus/embedeer` via `workspace:*`)

Each package has its own `CLAUDE.md` with package-specific architecture, commands, and conventions:

- [`packages/nudeer/CLAUDE.md`](packages/nudeer/CLAUDE.md)
- [`packages/embedeer/CLAUDE.md`](packages/embedeer/CLAUDE.md)
- [`packages/seedeer/CLAUDE.md`](packages/seedeer/CLAUDE.md)
- [`packages/chattydeer/CLAUDE.md`](packages/chattydeer/CLAUDE.md)

Read the relevant package's `CLAUDE.md` before working inside that package's directory.

## Canonical Documents (Keep in Sync)

Certain documents are the **source of truth** for information that appears in multiple places. Always update all copies when information changes:

| Document | What it owns | Sync points |
|---|---|---|
| **Root [`CLAUDE.md`](CLAUDE.md)** | Monorepo structure, workspace commands, release process | Package list must match `packages/` dirs. Commands must match root `package.json` scripts. |
| **Root [`README.md`](README.md)** | Public monorepo overview, package links | Package descriptions and links must match root `CLAUDE.md` and each package's `README.md`. |
| **Root [`CONTRIBUTING.md`](CONTRIBUTING.md)** | Governance: commits, changesets, testing, breaking changes | Must reflect current `.changeset/config.json`, `package.json` test scripts, and CI workflow. |
| **Package `package.json`** | Version, name, dependencies, scripts, repo metadata | Exports/entries must match type definitions. Scripts must match package `CLAUDE.md`. Repository URL must be `jsilvanus/deer` with `directory` field. |
| **Package `CLAUDE.md`** | Architecture, commands, conventions | Scripts must match `package.json`. Exports must match `index.d.ts` or `index.js`. Dependency calls must match `package.json` dependencies. |
| **Package `README.md`** | Public-facing API and features | Description must match `package.json`. Examples must match exported API in `CLAUDE.md`. Links to other packages must use root monorepo links. |
| **Package `index.d.ts` or `index.js`** | Public API surface | All exports must be documented in `CLAUDE.md` and `README.md`. Breaking changes here require major bump + migration guide. |
| **`.changeset/config.json`** | Changeset rules and version strategy | Bump rules, commit patterns, and package list must match `CONTRIBUTING.md` guidelines. |
| **`.github/workflows/release.yml`** | CI/CD for releases | Must run `pnpm test` for all packages. Publish commands must match `.changeset/config.json`. |

### Examples of sync failures to avoid

❌ **Package added to `packages/` but not listed in root `CLAUDE.md`** — Contributors don't know it exists.

❌ **`CLAUDE.md` says "run `pnpm daemon`" but `package.json` has no `daemon` script** — Commands fail.

❌ **`README.md` links to old GitHub org (e.g., `jsilvanus/embedeer`) instead of monorepo** — Users fork the wrong repo.

❌ **`package.json` lists 4 packages but `CONTRIBUTING.md` lists only 3 scopes in `.commitlintrc.json`** — Commits fail lint.

❌ **`seedeer/CLAUDE.md` documents a `fancyMode` option but it's not in `package.json` dependencies or exports** — Undocumented/unavailable feature.

❌ **Version bumps in `package.json` done manually instead of via Changesets** — Release automation breaks; `CHANGELOG.md` not updated.

### Sync checklist for changes

When you modify something that appears in multiple places, check:

- [ ] **Added a package?** Update root `CLAUDE.md` list + `README.md` + `.commitlintrc.json` scopes + `CONTRIBUTING.md`
- [ ] **Added a script/command?** Update `package.json` + package `CLAUDE.md`
- [ ] **Changed public API (exports)?** Update `index.d.ts` + package `README.md` + package `CLAUDE.md`
- [ ] **Updated a README?** Ensure links point to root monorepo and match `CLAUDE.md` descriptions
- [ ] **Changed governance rules?** Update `CONTRIBUTING.md`, `.commitlintrc.json`, and `.github/workflows/release.yml`
- [ ] **Updated dependencies?** Update package `CLAUDE.md` dependency list and package `README.md` if user-facing

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
