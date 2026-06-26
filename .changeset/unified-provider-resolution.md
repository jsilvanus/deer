---
"@jsilvanus/nudeer": minor
"@jsilvanus/embedeer": patch
"@jsilvanus/seedeer": patch
---

Unify GPU provider resolution across all packages via nudeer.

**nudeer:** Export sophisticated `resolveProvider(device, provider)` with CUDA library verification, ldconfig caching, and detailed error messages. Replaces simple `resolveDevice` to provide production-quality GPU detection.

**embedeer & seedeer:** Refactor to import `resolveProvider` from nudeer. All packages now use the same CUDA detection logic with library verification and helpful installation instructions. No public API changes.

Consolidates provider detection code, eliminating 3 duplicate implementations.
