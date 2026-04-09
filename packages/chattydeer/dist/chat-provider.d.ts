export declare function createChatProvider(httpUrl: string | undefined, model: string, apiKey?: string): {
    complete(req?: any): Promise<{
        message: any;
        tokensUsed: any;
        finishReason: any;
    }>;
    stream(req?: any): AsyncGenerator<{
        delta: string;
        done: boolean;
    }, void, unknown>;
    destroy(): Promise<void>;
};
export default createChatProvider;
