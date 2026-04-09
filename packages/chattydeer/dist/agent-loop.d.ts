/**
 * runAgentLoop — execute an agentic tool-calling loop using a ChatCompletionProvider.
 */
export declare function runAgentLoop(session: any, opts?: any): Promise<{
    answer: string;
    messages: any;
    roundtrips: number;
}>;
export default runAgentLoop;
