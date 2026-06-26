# @jsilvanus/chattydeer

## 0.5.1

### Patch Changes

- 0327647: Fix markdown links pointing to old standalone-repo GitHub orgs; point them at the monorepo (`jsilvanus/deer`) instead.
- Updated dependencies [a3b42c0]
- Updated dependencies [0327647]
- Updated dependencies [0029dc3]
- Updated dependencies [6499111]
  - @jsilvanus/embedeer@1.9.0
  - @jsilvanus/nudeer@0.2.0

## 0.5.0

### Minor Changes

- 586101c: Merge seedeer, embedeer, and chattydeer into a single `deer` pnpm-workspace monorepo. No functional changes to package behavior — this consolidates CI, releases, and Changesets into one repository (`jsilvanus/deer`) with full git history preserved for all three packages.

### Patch Changes

- 87dcb5a: Update README logo references to use package-specific asset filenames (chattydeer.png, embedeer.png, nudeer.png, seedeer.png) instead of generic logo.png naming. Add logo badges to nudeer and seedeer READMEs.
- Updated dependencies [586101c]
- Updated dependencies [87dcb5a]
  - @jsilvanus/embedeer@1.8.0

## 0.4.5

### Patch Changes

- da11736: add NPM_CONFIG_PROVENANCE:true to release workflow
- a669bd5: Set up automated versioning and npm publishing via Changesets and a CI-gated release workflow.

## 0.4.4

### Patch Changes

- `createChatProvider`: tool definitions are now sent as `body.tools:
[{ type: 'function', function: { name, description, parameters } }]`
  (the modern OpenAI/Ollama `/v1`/vLLM tool-calling shape) instead of the
  deprecated `body.functions`. Response parsing still accepts both
  `tool_calls` and the legacy `function_call` for backward compatibility.
- Added `createAgentSession(opts?)`, a minimal `{ history, append(msg) }`
  session factory accepted by `runAgentLoop` and `createChatProvider`,
  so callers no longer need to construct an LLM-backed `ChatSession` (or
  hand-roll a session object) just to drive the agent loop.

## 0.4.3

### Patch Changes

- `runAgentLoop`: tool calls/results now wire-map to the OpenAI chat-completions
  `tool_calls` / `tool_call_id` format instead of being collapsed to plain
  `system`/text messages, so any OpenAI-compatible endpoint (OpenAI, Ollama
  `/v1`, vLLM, llama.cpp server) round-trips tool calls correctly.
- `runAgentLoop`: `executeTool` now receives the full `ToolCall` object
  (`{ id, name, arguments }`) instead of positional `(name, args, id)`.
- `runAgentLoop`: exhausting `maxRoundtrips` now returns
  `{ answer, messages, roundtrips }` with the best-available answer instead
  of throwing.
- `ChatMessage` (role `'tool'`) now carries `toolCallId` so results can be
  matched back to the originating `ToolCall`.
- `createChatProvider`: added configurable request timeout (default 60s),
  `AbortSignal`/cancellation support via `req.signal`, and a bounded retry
  budget (default 2) with backoff for HTTP 429/5xx. HTTP errors now include
  status code and a body excerpt.
- `createChatProvider`: `stream()` now performs real SSE streaming of
  `delta` chunks, falling back to a single chunk for non-streaming responses.
