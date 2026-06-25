declare module '@jsilvanus/embedeer' {
  export function getCacheDir(cacheDir?: string): string;
  export function buildPipelineOptions(dtype?: string): any;
  export class WorkerPool {
    constructor(modelName: string, opts?: any);
    initialize(): Promise<void>;
    run(job: any): Promise<any>;
    destroy(): Promise<void>;
  }
  export function resolveProvider(device?: any, provider?: any): Promise<string | null>;
  export const DEFAULT_CACHE_DIR: string;
}

declare module '@jsilvanus/embedeer/src/provider-loader.js' {
  export function resolveProvider(device?: any, provider?: any): Promise<string | null>;
}

declare module '@huggingface/transformers' {
  export const env: any;
  export function pipeline(type: string, modelName: string, opts?: any): Promise<any> | any;
}
