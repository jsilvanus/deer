export declare function explainForGitsema(payload?: any, opts?: any): Promise<{
    explanation: string;
    labels: any;
    references: any;
    meta: {
        model: any;
        tokensUsed: number;
        deterministic: boolean;
    };
}>;
declare const _default: {
    explainForGitsema: typeof explainForGitsema;
};
export default _default;
