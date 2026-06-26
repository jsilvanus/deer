# @jsilvanus/nudeer

## 0.2.0

### Minor Changes

- 6499111: Unify GPU provider resolution across all packages via nudeer.

  **nudeer:** Export sophisticated `resolveProvider(device, provider)` with CUDA library verification, ldconfig caching, and detailed error messages. Replaces simple `resolveDevice` to provide production-quality GPU detection.

  **embedeer & seedeer:** Refactor to import `resolveProvider` from nudeer. All packages now use the same CUDA detection logic with library verification and helpful installation instructions. No public API changes.

  Consolidates provider detection code, eliminating 3 duplicate implementations.

### Patch Changes

- 0327647: Fix markdown links pointing to old standalone-repo GitHub orgs; point them at the monorepo (`jsilvanus/deer`) instead.

## 0.1.1

### Patch Changes

- 87dcb5a: Update README logo references to use package-specific asset filenames (chattydeer.png, embedeer.png, nudeer.png, seedeer.png) instead of generic logo.png naming. Add logo badges to nudeer and seedeer READMEs.
