# Contributing to deer

Guidelines for committing, changesets, and maintaining quality across the monorepo.

---

## Commit Message Format

We use **Conventional Commits** with package scope for clarity across the monorepo.

### Format

```
<type>(<package>): <summary>

<body>
```

Where:
- **type** — `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`
- **package** — one of: `nudeer`, `embedeer`, `seedeer`, `chattydeer`, or `root` (for workspace-wide changes)
- **summary** — imperative, present tense, lowercase, no period. ~50 chars max.
- **body** — optional. Explain _what_ changed and _why_, not _how_.

### Examples

```
feat(embedeer): add GPU memory auto-offload after idle timeout

When a model goes unused for --idle-timeout ms, release GPU memory
and reload on next request. Useful for shared servers handling bursty load.

fix(seedeer): correct proto path for gRPC server

The server was loading nudeer's proto file instead of seedeer's,
causing service name mismatch. Now uses seedeer/src/shared/model.proto.

refactor(chattydeer): consolidate explainer template logic

Extract 13 domain template renderers into shared switch. No behavior change.

docs(root): update README to reflect monorepo structure

Clarify that nudeer is the shared infrastructure layer.

chore(root): update TypeScript to 6.0.2
```

### Multi-package commits

If a change affects multiple packages, list them: `feat(embedeer,seedeer):` or create separate commits.

---

## Testing Requirements

**All tests must pass before merging.**

### Pre-commit

```bash
pnpm install      # ensure deps are current
pnpm test         # runs all tests for all affected packages
pnpm run lint     # eslint (if configured per package)
```

### In CI

- `pnpm test` runs on every PR and before merge to `main`
- All packages must pass; a failure blocks merge
- Live tests (requiring GPU/model downloads) can be skipped in CI, but unit tests are required
- Flaky tests must be fixed or marked as `skip()` with a comment linking the issue

### Adding tests

- Place tests in `test/*.test.js` (Node.js native test runner, no external frameworks)
- Use `import { test } from 'node:test'` and `import assert from 'node:assert'`
- Mock external dependencies (models, network calls) to keep tests fast
- One test file per module: `test/foo.test.js` for `src/foo.js`

---

## Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and publishing. A changeset is a `.md` file in `.changeset/` describing which packages change and by how much.

### When to create a changeset

**✅ CREATE a changeset for:**
- User-facing features (`feat`)
- Bug fixes (`fix`)
- Refactors that change public API or behavior (`refactor`)
- New exports, commands, or options

**❌ SKIP changesets for:**
- Documentation-only changes (except `README.md` changes)
- Internal refactors that don't change public API
- Dependency updates (unless they're breaking)
- Chore commits (e.g., CI config, linting)

**⚠️ SPECIAL CASE: README.md changes**
- If `README.md` changes for a package, create a **patch** changeset (user-facing documentation)

### Creating a changeset

```bash
pnpm changeset
```

This opens an interactive prompt:
1. Select affected packages
2. Choose bump type (patch/minor/major)
3. Describe the change

A `.changeset/<id>.md` file is created. Commit it with your PR.

### Bump type decision tree

```
Is it a breaking change?
├─ YES → MAJOR (but discuss before committing — see Breaking Changes below)
└─ NO → Is it a new public API (export, option, method)?
       ├─ YES → MINOR
       └─ NO → Is it a fix or internal behavior change?
              ├─ YES → PATCH
              └─ NO → (no changeset needed)
```

### Examples

**MINOR changeset** (new feature):
```yaml
"@jsilvanus/embedeer": minor
"@jsilvanus/seedeer": minor
---
Add optional `idleTimeout` to socket/gRPC servers for automatic model unloading.
```

**PATCH changeset** (bug fix):
```yaml
"@jsilvanus/seedeer": patch
---
Fix gRPC server proto path resolution.
```

**README.md PATCH changeset**:
```yaml
"@jsilvanus/embedeer": patch
---
Document new GPU memory auto-offload feature in README.
```

---

## Breaking Changes

**We avoid breaking changes.** When necessary, they require special approval.

### Before committing a breaking change

1. **Discuss in an issue or PR comment** — explain why it's necessary, what it breaks, and migration path
2. **Add a deprecation period** (if possible) — warn users in a minor release, break in the next major
3. **Document migration path** — provide before/after examples and a migration guide in `CHANGELOG.md`
4. **Update all docs** — `CLAUDE.md`, `README.md`, type definitions, examples

### Breaking change checklist (PR description)

```markdown
- [ ] Deprecation period considered (and documented, or discussed why not needed)
- [ ] Migration guide added to docs or CHANGELOG
- [ ] All public exports updated / type definitions changed
- [ ] README examples updated
- [ ] CLAUDE.md updated with new behavior
- [ ] MAJOR bump selected in changeset
```

### Examples of breaking changes

- Removing or renaming a public export
- Changing a required parameter signature
- Removing a CLI flag or changing its behavior
- Changing the default value of an option in a way that alters behavior

---

## Documentation Requirements

### Code comments

- **Default: no comments.** Well-named functions and variables are self-documenting.
- **Add a comment only if:**
  - The _why_ is non-obvious (e.g., "gRPC proto must be seedeer's, not nudeer's")
  - There's a subtle invariant or edge case
  - You're working around a known bug or limitation
  - Performance matters and the code is unintuitive

### Package CLAUDE.md

Update if you:
- Add a new command (`pnpm run X`)
- Add a new CLI flag
- Change execution modes or worker behavior
- Restructure the codebase

### README.md

Update if you:
- Add a new public export or class
- Add a new feature (captioning, embeddings, etc.)
- Change the primary use case or architecture
- Add or remove installation requirements

**Readme updates warrant a PATCH changeset** (user-facing documentation).

### Type definitions

All public exports must have TypeScript definitions:
- For ES module files, add `src/foo.d.ts` or use JSDoc `@typedef`
- Type `any` is acceptable for opaque LLM outputs (unavoidable in practice)
- Document non-obvious parameter types with JSDoc

### Changelog

The `CHANGELOG.md` is auto-generated by Changesets on release. You don't edit it directly. Instead:
- Write clear, user-facing changeset descriptions (go in the PR)
- Breaking changes get a `BREAKING:` prefix in the changeset
- Migration guides go in separate docs, linked from the changeset

---

## PR & Merge Checklist

Before merging to `main`:

- [ ] **All tests pass** — `pnpm test` (no skips except live tests)
- [ ] **Commit messages follow convention** — Conventional Commits with package scope
- [ ] **Changeset created** — unless it's docs-only (excluding README.md) or chore
- [ ] **README.md updated** — if user-facing (features, CLI, exports)
- [ ] **CLAUDE.md updated** — if architecture or commands changed
- [ ] **Type definitions present** — all public exports typed
- [ ] **No breaking changes** — or special approval + migration guide

---

## Workspace Commands

```bash
# Install workspace dependencies
pnpm install

# Test all packages
pnpm test

# Build all packages (no-op for most; TypeScript packages like chattydeer build)
pnpm run build

# Lint all packages (if configured)
pnpm run lint

# Create a changeset
pnpm changeset

# Test a single package
pnpm --filter @jsilvanus/embedeer test

# Run a script in a single package
pnpm --filter @jsilvanus/seedeer daemon
```

---

## Release Process

Handled by `.github/workflows/release.yml` — no manual steps needed except `pnpm changeset`.

1. **You commit:** changeset file included
2. **On merge to main:** release workflow runs `pnpm test`, then opens "Version Packages" PR
3. **Merge "Version Packages" PR:** bumps all affected packages, updates CHANGELOG, publishes to npm

Each package publishes independently (no linked versioning).

### Repository Configuration Required

For the release workflow to create pull requests, GitHub Actions must have the proper permissions:

1. Go to repository **Settings** → **Actions** → **General**
2. Under "Workflow permissions", select **"Read and write permissions"**
3. Check **"Allow GitHub Actions to create and approve pull requests"**

Without these settings, the release workflow will fail when trying to create the "Version Packages" PR.

---

## Questions?

- See root [`CLAUDE.md`](CLAUDE.md) for workspace structure
- See package-specific `CLAUDE.md` for internal architecture
- See `.changeset/` for changeset config (e.g., bump rules)
