---
"@jsilvanus/embedeer": patch
---

Refactor embedeer to use nudeer's generic WorkerPool abstraction, eliminating ~1575 lines of duplicate pool orchestration code. The public API remains unchanged; only internal implementation details are affected. embedeer now follows the same architecture pattern as seedeer.
