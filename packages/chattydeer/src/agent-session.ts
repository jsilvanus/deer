/**
 * createAgentSession — minimal session object accepted by runAgentLoop and
 * createChatProvider, matching the lightweight `{ history, append() }`
 * contract (distinct from the LLM-driven `ChatSession` class).
 */

export function createAgentSession(opts: any = {}) {
  const { systemPrompt, messages } = opts;
  const _history: any[] = Array.isArray(messages) ? [...messages] : [];

  if (systemPrompt) {
    _history.push({ role: 'system', content: systemPrompt });
  }

  return {
    get history() {
      return [..._history];
    },
    append(msg: any) {
      if (!msg || typeof msg !== 'object' || !msg.role) throw new Error('append requires a message with a role');
      const entry: any = { role: msg.role, content: String(msg.content ?? '') };
      if (msg.toolName) entry.toolName = msg.toolName;
      if (msg.toolCallId) entry.toolCallId = msg.toolCallId;
      if (msg.toolCalls) entry.toolCalls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
      _history.push(entry);
    },
  };
}

export default createAgentSession;
