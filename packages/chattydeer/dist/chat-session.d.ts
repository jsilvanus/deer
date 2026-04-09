/**
 * ChatSession — multi-turn conversation object with agentic tool-call loop.
 */
/** @typedef {{ id: string, name: string, arguments: Record<string, unknown> }} ToolCall */
/** @typedef {{ name: string, description: string, parameters?: Record<string, unknown> }} ToolDefinition */
/**
 * @typedef ChatMessage
 * @property {'system'|'user'|'assistant'|'tool'} role
 * @property {string} content
 * @property {string} [toolName]
 * @property {ToolCall[]} [toolCalls]
 */
export declare class ChatSession {
    adapter: any;
    tools: any[];
    _history: any[];
    static create(modelName: string, opts?: any): Promise<ChatSession>;
    constructor(adapter: any, { tools, systemPrompt }?: any);
    get history(): any[];
    append(msg: any): void;
    _buildPrompt(): string;
    _parseResponse(text: string): {
        toolCalls: any;
        finalAnswer: null;
    } | {
        toolCalls: null;
        finalAnswer: string;
    };
    send(userMessage: string, { executeTool, maxIterations, maxTokens }?: any): Promise<string>;
    destroy(): Promise<void>;
}
export default ChatSession;
