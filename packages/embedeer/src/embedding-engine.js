import { pipeline, env } from '@huggingface/transformers';
import { buildPipelineOptions } from './model-cache.js';
import { resolveProvider } from './provider-loader.js';

export async function createEngine(options) {
  const { modelName, pooling, normalize, token, dtype, cacheDir, device, provider } = options;

  if (token) process.env.HF_TOKEN = token;
  if (cacheDir) env.cacheDir = cacheDir;

  const deviceStr = await resolveProvider(device, provider);
  const pipelineOpts = {
    ...buildPipelineOptions(dtype),
    ...(deviceStr ? { device: deviceStr } : {}),
  };

  console.error(`Loading model ${modelName} into ${cacheDir || 'default cache'} (this may download)`);
  const extractor = await pipeline('feature-extraction', modelName, pipelineOpts);
  console.error(`Model ${modelName} loaded`);

  return {
    async run(texts) {
      const output = await extractor(texts, { pooling, normalize });
      return output.tolist();
    },
    async dispose() {
      // Pipeline doesn't expose a direct dispose method; model remains cached
    },
  };
}
