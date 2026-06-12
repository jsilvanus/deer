# Changelog

## 0.4.3

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
