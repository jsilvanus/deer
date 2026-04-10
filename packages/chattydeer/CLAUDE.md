# CLAUDE.md — chattydeer

## Project Overview

`@jsilvanus/chattydeer` (v0.4.0) is a lightweight Node.js/TypeScript library providing LLM-powered chat completions, deterministic structured explanations, and multi-turn agentic tool-calling. It wraps `@jsilvanus/embedeer` and `@huggingface/transformers` to provide:

- **Explainer** — deterministic, citation-aware JSON responses from LLM prompts
- **ChatSession** — multi-turn conversation with agentic tool-call loop
- **LLMAdapter** — HuggingFace Transformers text generation abstraction
- **OpenAI compatibility** — HTTP middleware exposing a `/v1/chat/completions` endpoint
- **gitsema integration** — adapter for semantic Git indexing and code analysis

---

## Repository Structure

```
chattydeer/
├── src/                        # TypeScript source (compiled to dist/)
│   ├── index.ts                # Public API re-exports (7 exports)
│   ├── explainer.ts            # Explainer class — prompt building, JSON repair, citation validation
│   ├── llm-adapter.ts          # LLMAdapter — HF Transformers text generation backend
│   ├── chat-session.ts         # ChatSession — multi-turn conversation + tool-call loop
│   ├── agent-loop.ts           # runAgentLoop — orchestrates provider + tool execution
│   ├── chat-provider.ts        # createChatProvider — OpenAI-compatible HTTP client
│   ├── openai-handler.ts       # createOpenAiChatHandler — Express middleware
│   ├── cli.ts                  # Interactive CLI (readline-based)
│   ├── gitsema-adapter.ts      # explainForGitsema — gitsema payload adapter
│   ├── explainer-templates.ts  # renderTemplate — 13 domain-specific prompt templates
│   ├── prompt-utils.ts         # estimateTokensFromChars, trimEvidenceForBudget
│   └── types/third-party.d.ts  # TypeScript declarations for external packages
├── test/                       # Node.js native test runner tests (*.test.js)
│   ├── explainer.test.js
│   ├── chat-session.test.js
│   ├── explainer-destroy.test.js
│   └── llm-adapter-destroy.test.js
├── dist/                       # Compiled JS output (git-ignored during dev)
├── assets/                     # Static assets (logo)
├── .github/workflows/ci.yml    # GitHub Actions CI pipeline
├── package.json
├── tsconfig.json               # Main TS config (ES2020, nodenext, strict)
├── tsconfig.types.json         # Declaration-only TS config
├── pnpm-workspace.yaml
├── README.md
├── chattydeer_contract.md      # API contract for gitsema integration
└── explainer-contract.md       # Explainer interface spec with acceptance criteria
```

---

## Development Commands

```bash
# Install dependencies (prefer pnpm)
pnpm install

# Compile TypeScript to dist/
pnpm run build

# Generate type declarations only
pnpm run build:types

# Build + run all tests
pnpm test

# Build + run tests with coverage report
pnpm run coverage

# Build + launch interactive CLI
pnpm run cli
```

> **Note:** `pnpm test` always builds first. Never run `node --test` directly against `test/` without building first, as the tests import from `dist/`.

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) triggers on pushes/PRs to `main`:

1. Setup Node 20 + pnpm
2. `pnpm install`
3. `pnpm run build && pnpm run build:types`
4. `pnpm test`

There are no pre-commit hooks configured. All quality gates are in CI.

---

## Public API

Everything exported from `src/index.ts`:

| Export | Type | Purpose |
|---|---|---|
| `Explainer` | class | Deterministic LLM explanation with JSON output and citation validation |
| `LLMAdapter` | class | HuggingFace Transformers text generation wrapper |
| `ChatSession` | class | Multi-turn conversation with agentic tool-call loop |
| `explainForGitsema` | function | Adapter: maps gitsema payload → Explainer call |
| `renderTemplate` | function | Returns domain-specific prompt preamble (13 domains) |
| `estimateTokensFromChars` | function | Rough token count from character length |
| `trimEvidenceForBudget` | function | Trims evidence array to fit context window budget |
| `createChatProvider` | function | OpenAI-compatible HTTP client provider |
| `runAgentLoop` | function | Runs agentic tool-calling loop with a ChatCompletionProvider |
| `createOpenAiChatHandler` | function | Returns Express middleware for `/v1/chat/completions` |

---

## Architecture & Design Patterns

### Layered Architecture

```
CLI (readline)
  └── ChatSession (multi-turn, tool-call parsing)
        └── LLMAdapter (text generation, HF Transformers)
              └── @huggingface/transformers + @jsilvanus/embedeer
```

OpenAI compatibility layer:
```
HTTP client → createChatProvider → ChatCompletionProvider.complete()/stream()
Express server ← createOpenAiChatHandler ← POST /v1/chat/completions
```

### Instantiation Pattern

All three main classes use **async factory methods** — do not use `new` directly in application code:

```typescript
const adapter = await LLMAdapter.create('model-name', opts);
const explainer = await Explainer.create('model-name', opts);
const session = await ChatSession.create('model-name', opts);
```

The constructor accepts an already-created adapter via `opts.adapter` to enable sharing:

```typescript
const adapter = await LLMAdapter.create('model-name');
const explainer = new Explainer(adapter);
const session = new ChatSession(adapter, { tools, systemPrompt });
```

### Tool-Calling Protocol

`ChatSession` uses a text-based tool-call format, not OpenAI's native tool format. The LLM is instructed to respond with JSON when invoking tools:

```json
{"toolCalls":[{"id":"<unique_id>","name":"<tool_name>","arguments":{...}}]}
```

A plain-text response (non-JSON or JSON without `toolCalls`) signals the final answer. The loop runs up to `maxIterations` (default: 10) before throwing.

### Explainer Response Format

`Explainer.explain()` always returns this shape:

```typescript
{
  explanation: string,       // text or "INSUFFICIENT_EVIDENCE"
  labels: string[],
  references: Array<{ id: number|string, [key: string]: unknown }>,
  meta: { model: string, tokensUsed: number, deterministic: boolean }
}
```

On parse failure or invalid citations, it falls back to `"INSUFFICIENT_EVIDENCE"` rather than throwing.

### Domain Templates

`renderTemplate(domain, { task, context })` supports 13 domains:
`evolution`, `security`, `performance`, `docs`, `api`, `ux`, `infra`, `legal`, `compliance`, `data`, `testing`, `architecture`, `general`

---

## Code Conventions

### Naming

- **PascalCase** for classes: `Explainer`, `LLMAdapter`, `ChatSession`
- **camelCase** for functions and variables: `renderTemplate`, `runAgentLoop`
- **Underscore prefix** for private class members: `_history`, `_buildPrompt()`, `_parseResponse()`, `_pool`, `_pipeline`

### TypeScript

- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- ES Module syntax throughout (`import`/`export`, `"type": "module"`)
- Target: ES2020, module resolution: `nodenext`
- Type annotations use `any` liberally for internal LLM-interop code (acceptable given the dynamic nature of LLM outputs)

### File Organization

- One class per file
- `src/index.ts` is the sole public entry point — add new exports there
- Tests live in `test/` as `.js` (not `.ts`) files using the native `node:test` module
- Import paths in source use `.js` extension (required for nodenext ESM): `import Foo from './foo.js'`

### Error Handling

- Constructors throw immediately on invalid adapter (missing `generate` method)
- `explain()` gracefully returns `INSUFFICIENT_EVIDENCE` rather than throwing on parse/validation failures
- `send()` throws after exceeding `maxIterations`
- Tool execution errors in `ChatSession` are caught and returned as tool result strings (no propagation)

### Resource Cleanup

All three main classes expose `async destroy()`. Always call it when done to release model resources:

```typescript
await session.destroy();
await explainer.destroy();
await adapter.destroy();
```

---

## Testing

Tests use the **Node.js native `node:test`** module with `assert` — no external test framework.

```bash
pnpm test        # build + run all tests
pnpm run coverage  # build + run with c8 coverage
```

Test files are plain `.js` (not `.ts`) and import from `dist/` after build. When writing tests:

- Use `import { test } from 'node:test'` and `import assert from 'node:assert'`
- Use mock adapters to avoid loading real HuggingFace models
- Place test files in `test/` with the naming pattern `<module-name>.test.js`

---

## Key Integration Points

### gitsema Integration

The `explainForGitsema(payload, adapter)` function bridges the gitsema semantic Git indexer to the Explainer. It maps gitsema's payload format to `Explainer.explain()` parameters. See `explainer-contract.md` for the full acceptance criteria and 13-template specification.

### OpenAI Compatibility

`createOpenAiChatHandler(session, tools)` returns Express middleware that handles `POST /v1/chat/completions` in OpenAI API format. Used to expose chattydeer sessions to OpenAI-compatible clients. See `chattydeer_contract.md` for redaction requirements and versioning.

---

## Package & Publishing

- **Package manager:** pnpm (preferred); npm supported via `package-lock.json`
- **Registry:** npm public (`publishConfig.access: "public"`)
- **Published files:** `assets/`, `dist/`, `README.md`, `explainer-contract.md`
- `prepare` and `prepublishOnly` both run `build + build:types` automatically

When bumping the version, update `package.json` version field and ensure `dist/` is rebuilt before publishing.
