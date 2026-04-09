/**
 * Explainer — lightweight wrapper that builds deterministic prompts,
 * calls an LLM adapter, parses/repairs JSON output and validates citations.
 */
export declare class Explainer {
    adapter: any;
    deterministic: boolean;
    static create(modelName: string, opts?: any): Promise<Explainer>;
    constructor(adapter: any, { deterministic }?: any);
    buildPrompt(request: any, maxTokens?: number): string;
    tryParseJson(text: string): any;
    extractFirstJson(text: string): any;
    repairToJson(rawText: string): Promise<any>;
    validateReferences(parsed: any, evidence: any): boolean;
    explain(request?: any): Promise<{
        explanation: string;
        labels: any;
        references: any;
        meta: {
            model: any;
            tokensUsed: number;
            deterministic: boolean;
        };
    }>;
    destroy(): Promise<void>;
}
export default Explainer;
