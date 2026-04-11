/**
 * ChatSession — multi-turn conversation object with agentic tool-call loop.
 */

import LLMAdapter from './llm-adapter.js';

/** @typedef {{ id: string, name: string, arguments: Record<string, unknown> }} ToolCall */
/** @typedef {{ name: string, description: string, parameters?: Record<string, unknown> }} ToolDefinition */
/**
 * @typedef ChatMessage
 * @property {'system'|'user'|'assistant'|'tool'} role
 * @property {string} content
 * @property {string} [toolName]
 * @property {ToolCall[]} [toolCalls]
 */

export class ChatSession {
  adapter: any;
  tools: any[];
  _history: any[];
  static async create(modelName: string, opts: any = {}) {
    const { tools = [], systemPrompt = '', adapter, ...adapterOpts } = opts;

    const llmAdapter = adapter ?? await LLMAdapter.create(modelName, adapterOpts);
    return new ChatSession(llmAdapter, { tools, systemPrompt });
  }

  constructor(adapter: any, { tools = [], systemPrompt = '' }: any = {}) {
    if (!adapter || typeof adapter.generate !== 'function') {
      throw new Error('adapter must implement generate(prompt, opts)');
    }
    this.adapter = adapter;
    this.tools = Array.isArray(tools) ? tools : [];
    this._history = [];

    if (systemPrompt) {
      this._history.push({ role: 'system', content: systemPrompt });
    }
  }

  get history() {
    return [...this._history];
  }

  append(msg: any) {
    if (!msg || typeof msg !== 'object' || !msg.role) throw new Error('append requires a message with a role');
    const entry: any = { role: msg.role, content: String(msg.content ?? '' ) };
    if (msg.toolName) entry.toolName = msg.toolName;
    if (msg.toolCalls) entry.toolCalls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
    this._history.push(entry);
  }

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

    const lines = this._history.map((m: any) => {
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

  _parseResponse(text: string) {
    const trimmed = text.trim();

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && Array.isArray(parsed.toolCalls) && parsed.toolCalls.length > 0) {
        return { toolCalls: parsed.toolCalls, finalAnswer: null };
      }
    } catch {
      // not pure JSON — try to extract an embedded JSON object
    }

    let searchFrom = 0;
    while (searchFrom < trimmed.length) {
      const start = trimmed.indexOf('{', searchFrom);
      if (start === -1) break;

      let depth = 0;
      let end = -1;
      for (let i = start; i < trimmed.length; i++) {
        if (trimmed[i] === '{') depth++;
        else if (trimmed[i] === '}') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }

      if (end === -1) break;

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

  async send(userMessage: string, { executeTool, maxIterations = 10, maxTokens = 512 } : any = {}) {
    this._history.push({ role: 'user', content: String(userMessage) });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const prompt = this._buildPrompt();
      const genRes = await this.adapter.generate(prompt, { maxTokens });
      const rawText = String(genRes.text ?? '');

      const { toolCalls, finalAnswer } = this._parseResponse(rawText);

      if (finalAnswer !== null) {
        // Small causal LMs often hallucinate the next turn of conversation.
        // Truncate at the first role marker that appears after the start.
        const roleMarker = /\n(?:System|User|Assistant|Tool)\s*:/;
        const cut = finalAnswer.search(roleMarker);
        const cleanAnswer = (cut !== -1 ? finalAnswer.slice(0, cut) : finalAnswer).trim();
        this._history.push({ role: 'assistant', content: cleanAnswer });
        return cleanAnswer;
      }

      this._history.push({ role: 'assistant', content: rawText, toolCalls: toolCalls ?? [] });

      if (typeof executeTool !== 'function' || toolCalls.length === 0) {
        return rawText;
      }

      for (const call of toolCalls) {
        let result: any;
        try {
          result = await executeTool(call.name, call.arguments ?? {}, call.id);
        } catch (err: any) {
          result = `Error executing tool \"${call.name}\": ${err.message}`;
        }
        this._history.push({ role: 'tool', content: String(result), toolName: call.name });
      }
    }

    throw new Error(
      `ChatSession: agentic loop exceeded maximum iterations (${maxIterations}) without producing a final answer`,
    );
  }

  async destroy() {
    if (this.adapter && typeof this.adapter.destroy === 'function') {
      await this.adapter.destroy();
    }
  }
}

export default ChatSession;
