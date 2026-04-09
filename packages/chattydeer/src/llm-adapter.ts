/**
 * LLMAdapter — small abstraction over a text-generation backend.
 */

import { pipeline, env } from '@huggingface/transformers';
import { getCacheDir, buildPipelineOptions, WorkerPool } from '@jsilvanus/embedeer';
import { resolveProvider } from '@jsilvanus/embedeer/src/provider-loader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export class LLMAdapter {
  generateFn: any;
  modelName: string;
  deterministic: boolean;
  _pool: any;
  _pipeline: any;
  static async create(modelName: string, opts: any = {}) {
    const { token, dtype, cacheDir, device, provider, generateFn, deterministic, useWorkerPool, poolSize, mode } = opts;

    if (generateFn) {
      return new LLMAdapter(generateFn, modelName, !!deterministic);
    }

    if (token) process.env.HF_TOKEN = token;
    const resolvedCache = getCacheDir(cacheDir);
    env.cacheDir = resolvedCache;

    if (useWorkerPool) {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const workerScript = join(__dirname, 'worker-gen.js');
      const threadWorkerScript = join(__dirname, 'thread-worker-gen-script.js');

      const pool = new WorkerPool(modelName, {
        poolSize: poolSize ?? 1,
        mode: mode ?? 'process',
        token,
        dtype,
        cacheDir: resolvedCache,
        device,
        provider,
        workerScript,
        threadWorkerScript,
      });
      await pool.initialize();

      const generateFnPool = async (prompt: string, genOpts: any = {}) => {
        const res = await pool.run({ prompt, genOpts });
        return { text: String(res ?? ''), raw: null };
      };

      const adapter = new LLMAdapter(generateFnPool, modelName, !!deterministic);
      (adapter as any)._pool = pool;
      return adapter;
    }

    const deviceStr = await resolveProvider(device, provider);
    const pipelineOpts = {
      ...buildPipelineOptions(dtype),
      ...(deviceStr ? { device: deviceStr } : {}),
    };

    const gen = await pipeline('text-generation', modelName, pipelineOpts);

    const generateFnLocal = async (prompt: string, genOpts: any = {}) => {
      const out = await gen(prompt, genOpts);
      let text = '';
      if (Array.isArray(out) && out.length > 0) {
        const item: any = (out as any)[0];
        text = item.generated_text ?? item.text ?? JSON.stringify(out);
      } else {
        text = String(out);
      }
      return { text, raw: out };
    };

    const adapter = new LLMAdapter(generateFnLocal, modelName, !!deterministic);
    (adapter as any)._pipeline = gen;
    return adapter;
  }

  constructor(generateFn: any, modelName = 'local', deterministic = true) {
    if (typeof generateFn !== 'function') throw new Error('generateFn must be a function');
    this.generateFn = generateFn;
    this.modelName = modelName;
    this.deterministic = deterministic;
  }

  async generate(prompt: string, { maxTokens = 256, temperature = 0, top_k = 1, top_p = 1, do_sample = false, ...rest } : any = {}) {
    const genOpts = {
      max_new_tokens: maxTokens,
      temperature,
      top_k,
      top_p,
      do_sample,
      ...rest,
    };
    const res = await this.generateFn(prompt, genOpts);
    return { text: res.text ?? '', raw: res.raw ?? null, meta: { model: this.modelName } };
  }

  async destroy() {
    if ((this as any)._pool && typeof (this as any)._pool.destroy === 'function') {
      try { await (this as any)._pool.destroy(); } catch (err) { console.error('LLMAdapter: error destroying pool', err); }
      (this as any)._pool = undefined;
    }

    if ((this as any)._pipeline) {
      try {
        if (typeof (this as any)._pipeline.cleanup === 'function') await (this as any)._pipeline.cleanup();
        else if (typeof (this as any)._pipeline.destroy === 'function') await (this as any)._pipeline.destroy();
      } catch (err) {
        // Non-fatal
      }
      (this as any)._pipeline = undefined;
    }
  }
}

export default LLMAdapter;
