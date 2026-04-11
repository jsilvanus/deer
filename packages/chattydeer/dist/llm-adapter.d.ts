/**
 * LLMAdapter — small abstraction over a text-generation backend.
 *
 * Backend dependencies (@huggingface/transformers, @jsilvanus/embedeer) are
 * loaded lazily via dynamic import inside create() so that callers who inject
 * their own generateFn never pay the cost of loading those packages, and so
 * that the adapter core remains decoupled from any specific backend.
 */
export declare class LLMAdapter {
    generateFn: any;
    modelName: string;
    deterministic: boolean;
    _pool: any;
    _pipeline: any;
    static create(modelName: string, opts?: any): Promise<LLMAdapter>;
    constructor(generateFn: any, modelName?: string, deterministic?: boolean);
    generate(prompt: string, { maxTokens, temperature, top_k, top_p, do_sample, ...rest }?: any): Promise<{
        text: any;
        raw: any;
        meta: {
            model: string;
        };
    }>;
    destroy(): Promise<void>;
}
export default LLMAdapter;
