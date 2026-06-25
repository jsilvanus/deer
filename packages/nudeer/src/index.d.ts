export declare class WorkerPool {
  constructor(enginePath: string, options?: WorkerPoolOptions);
  initialize(): Promise<void>;
  run(task: any): Promise<any>;
  destroy(): Promise<void>;
}

export interface WorkerPoolOptions {
  mode?: 'process' | 'thread' | 'socket' | 'grpc';
  concurrency?: number;
  engineOptions?: Record<string, any>;
  servers?: string[] | Record<string, any>[];
}

export declare class FifoQueue {
  push(item: any): void;
  shift(): any;
  length: number;
}

export declare function createModelServerCore(options: {
  enginePath: string;
  engineOptions?: Record<string, any>;
  concurrency?: number;
}): {
  start(): Promise<void>;
  run(task: any): Promise<any>;
  stop(): Promise<void>;
};

export declare function connectSocketClients(
  servers?: Array<string | { path?: string; host?: string; port?: number }>
): Promise<Array<{ run(task: any): Promise<any>; close(): Promise<void> }>>;

export declare function defaultSocketPath(): string;

export declare function connectGrpcClients(
  servers?: string[]
): Promise<Array<{ run(task: any): Promise<any>; close(): Promise<void> }>>;

export declare function defaultGrpcTarget(): string;

export declare function defaultCacheDir(appName?: string): string;

export declare function resolveDevice(options?: {
  device?: 'cpu' | 'gpu' | 'auto';
  provider?: 'cpu' | 'cuda' | 'dml';
}): string;
