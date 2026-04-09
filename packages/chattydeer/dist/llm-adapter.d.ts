/**
 * LLMAdapter — small abstraction over a text-generation backend.
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
