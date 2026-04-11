/**
 * runAgentLoop — execute an agentic tool-calling loop using a ChatCompletionProvider.
 */
export async function runAgentLoop(session, opts = {}) {
    const { provider, tools = [], executeTool, maxRoundtrips = 5, maxTokens, temperature, onMessage, 
    // transformContent: generic hook to preprocess each message's content
    // before sending to the provider (e.g. redaction, sanitisation, masking).
    // redactContent is accepted as a backward-compatible alias.
    transformContent, redactContent, } = opts;
    const contentTransformer = transformContent ?? redactContent;
    if (!provider || typeof provider.complete !== 'function')
        throw new Error('provider with complete() required');
    if (!executeTool || typeof executeTool !== 'function')
        throw new Error('executeTool callback required');
    let roundtrips = 0;
    while (roundtrips < maxRoundtrips) {
        const srcMessages = Array.isArray(session.history) ? session.history : (typeof session.history === 'function' ? session.history() : session.history);
        const redacted = (Array.isArray(srcMessages) ? srcMessages : []).map((m) => {
            const content = String(m.content ?? '');
            return { role: m.role, content: typeof contentTransformer === 'function' ? contentTransformer(content) : content, toolName: m.toolName };
        });
        const resp = await provider.complete({ session: { messages: redacted }, tools, maxTokens, temperature });
        const message = resp.message ?? { role: 'assistant', content: '' };
        const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : null;
        if (toolCalls && toolCalls.length > 0) {
            session.append({ role: 'assistant', content: String(message.content ?? ''), toolCalls });
            if (typeof onMessage === 'function')
                onMessage({ role: 'assistant', content: String(message.content ?? ''), toolCalls });
            for (const call of toolCalls) {
                let result;
                try {
                    result = await executeTool(call.name, call.arguments ?? {}, call.id);
                }
                catch (err) {
                    result = `Error executing tool "${call.name}": ${err && err.message ? err.message : String(err)}`;
                }
                session.append({ role: 'tool', content: String(result ?? ''), toolName: call.name });
                if (typeof onMessage === 'function')
                    onMessage({ role: 'tool', content: String(result ?? ''), toolName: call.name });
            }
            roundtrips++;
            continue;
        }
        const final = String(message.content ?? '');
        session.append({ role: 'assistant', content: final });
        if (typeof onMessage === 'function')
            onMessage({ role: 'assistant', content: final });
        return { answer: final, messages: session.history, roundtrips };
    }
    throw new Error(`Agent loop exceeded maxRoundtrips (${maxRoundtrips})`);
}
export default runAgentLoop;
