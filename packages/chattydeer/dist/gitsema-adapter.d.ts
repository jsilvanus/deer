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
export declare function explainFromPayload(payload?: any, opts?: any): Promise<{
    explanation: string;
    labels: any;
    references: any;
    meta: {
        model: any;
        tokensUsed: number;
        deterministic: boolean;
    };
}>;
/**
 * explainForGitsema — backward-compatible alias for explainFromPayload.
 *
 * @deprecated The gitsema-specific adapter logic belongs in the gitsema
 * project.  Prefer explainFromPayload for new integrations, or call
 * Explainer directly.
 */
export declare const explainForGitsema: typeof explainFromPayload;
declare const _default: {
    explainFromPayload: typeof explainFromPayload;
    explainForGitsema: typeof explainFromPayload;
};
export default _default;
