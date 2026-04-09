/**
 * ChatSession — multi-turn conversation object with agentic tool-call loop.
 *
 * Supports an agentic loop where the LLM can request tool executions via
 * structured JSON responses, enabling gitsema's guide interactive chat:
 *
 *   User asks a question.
 *   → LLM decides which tools to call (e.g. semantic_search, recent_commits).
 *   → ChatSession executes the tool calls and feeds results back.
 *   → Repeat until the LLM returns a plain-text final answer.
 *
 * @example
 * const session = await ChatSession.create('llama-3.2-3b', {
 *   systemPrompt: 'You are a gitsema guide assistant.',
 *   tools: [
 *     { name: 'semantic_search', description: 'Search the codebase semantically.',
 *       parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
 *   ],
 * });
 *
 * const answer = await session.send('Which files handle authentication?', {
 *   executeTool: async (name, args) => {
 *     if (name === 'semantic_search') return mySearch(args.query);
 *     throw new Error(`Unknown tool: ${name}`);
 *   },
 * });
 *
 * console.log(answer);
 * await session.destroy();
 */

import LLMAdapter from './llm-adapter.js';

/** @typedef {{ id: string, name: string, arguments: Record<string, unknown> }} ToolCall */
/** @typedef {{ name: string, description: string, parameters?: Record<string, unknown> }} ToolDefinition */
/**
 * @typedef ChatMessage
 * @property {'system'|'user'|'assistant'|'tool'} role
 * @property {string} content
 * @property {string} [toolName]     - Present when role='tool'
 * @property {ToolCall[]} [toolCalls] - Present when role='assistant' and tool calls were requested
 */

export class ChatSession {
  /**
   * Create a ChatSession bound to a model or adapter.
   *
   * @param {string} modelName
   * @param {object} [opts]
   * @param {ToolDefinition[]} [opts.tools]        - Tool definitions available to the LLM.
   * @param {string} [opts.systemPrompt]           - System-level instruction for the session.
   * @param {object} [opts.adapter]                - Pre-built LLMAdapter instance (skips model load).
   * @param {Function} [opts.generateFn]           - Custom generate function (for testing).
   * @param {boolean} [opts.deterministic]         - Use deterministic (greedy) generation. Default: true.
   */
  static async create(modelName, opts = {}) {
    const { tools = [], systemPrompt = '', adapter, ...adapterOpts } = opts;

    const llmAdapter = adapter ?? await LLMAdapter.create(modelName, adapterOpts);
    return new ChatSession(llmAdapter, { tools, systemPrompt });
  }

  /**
   * @param {object} adapter           - LLMAdapter instance (must implement `generate`).
   * @param {object} [opts]
   * @param {ToolDefinition[]} [opts.tools]
   * @param {string} [opts.systemPrompt]
   */
  constructor(adapter, { tools = [], systemPrompt = '' } = {}) {
    if (!adapter || typeof adapter.generate !== 'function') {
      throw new Error('adapter must implement generate(prompt, opts)');
    }
    this.adapter = adapter;
    this.tools = Array.isArray(tools) ? tools : [];
    this._history = /** @type {ChatMessage[]} */ ([]);

    if (systemPrompt) {
      this._history.push({ role: 'system', content: systemPrompt });
    }
  }

  /**
   * The full conversation history (immutable snapshot).
   * @returns {ChatMessage[]}
   */
  get history() {
    return [...this._history];
  }

  /**
   * Build a text prompt from the current conversation history and tool definitions.
   * @returns {string}
   */
  _buildPrompt() {
    let toolsSection = '';
    if (this.tools.length > 0) {
      toolsSection =
        '\n\nAvailable tools (call by responding with JSON):\n' +
        JSON.stringify(this.tools, null, 2) +
        '\n\nTo call one or more tools, respond ONLY with valid JSON in this exact shape:\n' +
        '{"toolCalls":[{"id":"<unique_id>","name":"<tool_name>","arguments":{...}}]}\n' +
        'When you have your final answer (no more tool calls needed), respond with plain text.';
    }

    const lines = this._history.map((m) => {
      switch (m.role) {
        case 'system':    return `System: ${m.content}`;
        case 'user':      return `User: ${m.content}`;
        case 'assistant': return `Assistant: ${m.content}`;
        case 'tool':      return `Tool (${m.toolName ?? 'unknown'}): ${m.content}`;
        default:          return `${m.role}: ${m.content}`;
      }
    });

    return lines.join('\n') + toolsSection + '\nAssistant:';
  }

  /**
   * Parse an assistant response to detect tool-call JSON vs a plain final answer.
   *
   * @param {string} text
   * @returns {{ toolCalls: ToolCall[]|null, finalAnswer: string|null }}
   */
  _parseResponse(text) {
    const trimmed = text.trim();

    // Fast path: direct JSON parse
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && Array.isArray(parsed.toolCalls) && parsed.toolCalls.length > 0) {
        return { toolCalls: parsed.toolCalls, finalAnswer: null };
      }
    } catch {
      // not pure JSON — try to extract an embedded JSON object
    }

    // Walk through the text looking for balanced { } blocks that contain toolCalls.
    let searchFrom = 0;
    while (searchFrom < trimmed.length) {
      const start = trimmed.indexOf('{', searchFrom);
      if (start === -1) break;

      // Find the matching closing brace by tracking depth
      let depth = 0;
      let end = -1;
      for (let i = start; i < trimmed.length; i++) {
        if (trimmed[i] === '{') depth++;
        else if (trimmed[i] === '}') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }

      if (end === -1) break; // unbalanced — no point continuing

      const candidate = trimmed.slice(start, end + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && Array.isArray(parsed.toolCalls) && parsed.toolCalls.length > 0) {
          return { toolCalls: parsed.toolCalls, finalAnswer: null };
        }
      } catch {
        // not a valid JSON object, keep searching
      }

      searchFrom = start + 1;
    }

    return { toolCalls: null, finalAnswer: text };
  }

  /**
   * Send a user message and run the agentic loop until a final answer is returned.
   *
   * @param {string} userMessage
   * @param {object} [opts]
   * @param {Function} [opts.executeTool]  - `async (name, args, callId) => result`
   *   Called for each tool call the LLM requests. Must return a string or
   *   value coercible to string. May throw; errors are forwarded to the LLM.
   * @param {number} [opts.maxIterations]  - Maximum agentic loop iterations. Default: 10.
   * @param {number} [opts.maxTokens]      - Max tokens per LLM call. Default: 512.
   * @returns {Promise<string>} The LLM's final plain-text answer.
   */
  async send(userMessage, { executeTool, maxIterations = 10, maxTokens = 512 } = {}) {
    this._history.push({ role: 'user', content: String(userMessage) });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const prompt = this._buildPrompt();
      const genRes = await this.adapter.generate(prompt, { maxTokens });
      const rawText = String(genRes.text ?? '');

      const { toolCalls, finalAnswer } = this._parseResponse(rawText);

      if (finalAnswer !== null) {
        // LLM produced a plain-text answer — record it and return
        this._history.push({ role: 'assistant', content: finalAnswer });
        return finalAnswer;
      }

      // LLM wants to call tools
      this._history.push({ role: 'assistant', content: rawText, toolCalls: toolCalls ?? [] });

      if (typeof executeTool !== 'function' || toolCalls.length === 0) {
        // No executor provided — treat raw response as final answer
        return rawText;
      }

      // Execute each requested tool and append results to history
      for (const call of toolCalls) {
        let result;
        try {
          result = await executeTool(call.name, call.arguments ?? {}, call.id);
        } catch (err) {
          result = `Error executing tool "${call.name}": ${err.message}`;
        }
        this._history.push({
          role: 'tool',
          content: String(result),
          toolName: call.name,
        });
      }
    }

    throw new Error(
      `ChatSession: agentic loop exceeded maximum iterations (${maxIterations}) without producing a final answer`,
    );
  }

  /**
   * Clean up underlying adapter resources (worker pools, pipelines).
   */
  async destroy() {
    if (this.adapter && typeof this.adapter.destroy === 'function') {
      await this.adapter.destroy();
    }
  }
}

export default ChatSession;
