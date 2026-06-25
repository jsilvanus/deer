/**
 * runAgentLoop — execute an agentic tool-calling loop using a ChatCompletionProvider.
 */

export async function runAgentLoop(session: any, opts: any = {}) {
  const {
    provider,
    tools = [],
    executeTool,
    maxRoundtrips = 5,
    maxTokens,
    temperature,
    onMessage,
    // transformContent: generic hook to preprocess each message's content
    // before sending to the provider (e.g. redaction, sanitisation, masking).
    // redactContent is accepted as a backward-compatible alias.
    transformContent,
    redactContent,
  } = opts;

  const contentTransformer = transformContent ?? redactContent;

  if (!provider || typeof provider.complete !== 'function') throw new Error('provider with complete() required');
  if (!executeTool || typeof executeTool !== 'function') throw new Error('executeTool callback required');

  let roundtrips = 0;
  let lastAnswer = '';

  while (roundtrips < maxRoundtrips) {
    const srcMessages = Array.isArray(session.history) ? session.history : (typeof session.history === 'function' ? session.history() : session.history);
    const redacted = (Array.isArray(srcMessages) ? srcMessages : []).map((m: any) => {
      const content = String(m.content ?? '');
      const out: any = {
        role: m.role,
        content: typeof contentTransformer === 'function' ? contentTransformer(content) : content,
        toolName: m.toolName,
      };
      if (m.toolCallId) out.toolCallId = m.toolCallId;
      if (m.toolCalls) out.toolCalls = m.toolCalls;
      return out;
    });

    const resp = await provider.complete({ session: { messages: redacted }, tools, maxTokens, temperature });
    const message = resp.message ?? { role: 'assistant', content: '' };

    const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : null;
    if (toolCalls && toolCalls.length > 0) {
      session.append({ role: 'assistant', content: String(message.content ?? ''), toolCalls });
      if (typeof onMessage === 'function') onMessage({ role: 'assistant', content: String(message.content ?? ''), toolCalls });

      for (const call of toolCalls) {
        let result: any;
        try {
          result = await executeTool(call);
        } catch (err: any) {
          result = `Error executing tool "${call.name}": ${err && err.message ? err.message : String(err)}`;
        }
        const toolMsg = { role: 'tool', content: String(result ?? ''), toolName: call.name, toolCallId: call.id };
        session.append(toolMsg);
        if (typeof onMessage === 'function') onMessage(toolMsg);
      }

      roundtrips++;
      continue;
    }

    const final = String(message.content ?? '');
    lastAnswer = final;
    session.append({ role: 'assistant', content: final });
    if (typeof onMessage === 'function') onMessage({ role: 'assistant', content: final });

    return { answer: final, messages: session.history, roundtrips };
  }

  return { answer: lastAnswer, messages: session.history, roundtrips };
}

export default runAgentLoop;
