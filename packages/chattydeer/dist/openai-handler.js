import { randomUUID } from 'crypto';
import runAgentLoop from './agent-loop.js';
export function createOpenAiChatHandler(provider, tools = [], executeTool, opts = {}) {
    const { redactContent, maxRoundtrips = 5 } = opts;
    if (!provider || typeof provider.complete !== 'function') {
        throw new Error('provider with complete() is required');
    }
    return async function openAiHandler(req, res, next) {
        try {
            const body = req.body || {};
            const stream = !!body.stream;
            if (stream) {
                res.status(501).json({ error: 'streaming not supported' });
                return;
            }
            const model = body.model || 'unknown';
            const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
            const session = {
                _history: [],
                get history() { return [...this._history]; },
                append(msg) { this._history.push(msg); },
            };
            for (const m of incomingMessages) {
                const role = m.role || 'user';
                const content = String(m.content ?? '');
                const redacted = typeof redactContent === 'function' ? redactContent(content) : content;
                session.append({ role, content: redacted });
            }
            const reqTools = Array.isArray(body.functions) ? body.functions.map((f) => ({ name: f.name, description: f.description, parameters: f.parameters ?? {} })) : tools;
            const agentResult = await runAgentLoop(session, {
                provider,
                tools: reqTools,
                executeTool,
                maxRoundtrips,
                maxTokens: body.max_tokens ?? body.maxTokens,
                temperature: body.temperature,
                redactContent,
            });
            const answer = String(agentResult.answer ?? '');
            const response = {
                id: `chatcmpl-${randomUUID()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model,
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                choices: [{ index: 0, message: { role: 'assistant', content: answer }, finish_reason: 'stop' }],
            };
            res.json(response);
        }
        catch (err) {
            if (typeof next === 'function')
                return next(err);
            res.status(500).json({ error: String(err && err.message ? err.message : err) });
        }
    };
}
export default createOpenAiChatHandler;
