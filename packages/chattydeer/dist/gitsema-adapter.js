import { Explainer } from './explainer.js';
/**
 * explainFromPayload — generic helper that creates an Explainer from a model
 * name, maps a plain payload object to an explain request, runs it, and
 * optionally destroys the explainer afterwards.
 *
 * The payload shape is intentionally generic: any object that carries
 * { task, domain, context, evidence, maxTokens, model } fields.  This keeps
 * the adapter decoupled from any specific upstream project's data format.
 *
 * Callers (e.g. gitsema) are responsible for mapping their own payload to
 * this shape before calling this function.
 */
export async function explainFromPayload(payload = {}, opts = {}) {
    const { autoDestroy = false } = opts;
    const modelName = payload.model || opts.model || 'default-model';
    const explainer = await Explainer.create(modelName, opts);
    const request = {
        task: payload.task || 'explain',
        domain: payload.domain || 'general',
        context: payload.context || {},
        evidence: payload.evidence || [],
        maxTokens: payload.maxTokens || 256,
    };
    let res;
    try {
        res = await explainer.explain(request);
    }
    finally {
        if (autoDestroy && typeof explainer.destroy === 'function') {
            try {
                await explainer.destroy();
            }
            catch (err) { /* ignore */ }
        }
    }
    return res;
}
/**
 * explainForGitsema — backward-compatible alias for explainFromPayload.
 *
 * @deprecated The gitsema-specific adapter logic belongs in the gitsema
 * project.  Prefer explainFromPayload for new integrations, or call
 * Explainer directly.
 */
export const explainForGitsema = explainFromPayload;
export default { explainFromPayload, explainForGitsema };
