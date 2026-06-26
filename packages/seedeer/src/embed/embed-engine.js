import { resolveProvider, defaultCacheDir } from '@jsilvanus/nudeer';
import { loadRawImage } from '../shared/image-input.js';

/**
 * The engine module loaded by WorkerPool workers (and by socket/grpc
 * servers) for both JointEmbedder ('joint') and VisualEmbedder ('visual').
 * Not meant to be imported by consumers directly — go through
 * JointEmbedder/VisualEmbedder.
 */
export async function createEngine({ kind, modelName, device, provider, cacheDir, dtype }) {
  if (kind === 'joint') return createJointEngine({ modelName, device, provider, cacheDir, dtype });
  if (kind === 'visual') return createVisualEngine({ modelName, device, provider, cacheDir, dtype });
  throw new Error(`Unknown embed engine kind "${kind}". Expected "joint" or "visual".`);
}

async function createJointEngine({ modelName, device, provider, cacheDir, dtype }) {
  const { CLIPTextModelWithProjection, CLIPVisionModelWithProjection, AutoTokenizer, AutoProcessor } =
    await import('@huggingface/transformers');
  const resolvedDevice = await resolveProvider(device, provider);
  const cache_dir = cacheDir ?? defaultCacheDir('seedeer');
  const pretrainedOptions = { cache_dir, device: resolvedDevice, dtype: dtype ?? 'fp32' };

  const [tokenizer, processor, textModel, visionModel] = await Promise.all([
    AutoTokenizer.from_pretrained(modelName, { cache_dir }),
    AutoProcessor.from_pretrained(modelName, { cache_dir }),
    CLIPTextModelWithProjection.from_pretrained(modelName, pretrainedOptions),
    CLIPVisionModelWithProjection.from_pretrained(modelName, pretrainedOptions),
  ]);

  return {
    async run(task) {
      if (task.type === 'embedImages') {
        const images = await Promise.all(task.images.map(loadRawImage));
        const inputs = await processor(images);
        const { image_embeds } = await visionModel(inputs);
        return l2NormalizeRows(tensorToRows(image_embeds));
      }
      if (task.type === 'embedText') {
        const inputs = tokenizer(task.texts, { padding: true, truncation: true });
        const { text_embeds } = await textModel(inputs);
        return l2NormalizeRows(tensorToRows(text_embeds));
      }
      throw new Error(`Unknown joint-embedder task type "${task.type}".`);
    },
    async dispose() {
      await Promise.all([textModel.dispose?.(), visionModel.dispose?.()]);
    },
  };
}

async function createVisualEngine({ modelName, device, provider, cacheDir, dtype }) {
  const { AutoProcessor, AutoModel } = await import('@huggingface/transformers');
  const resolvedDevice = await resolveProvider(device, provider);
  const cache_dir = cacheDir ?? defaultCacheDir('seedeer');
  const pretrainedOptions = { cache_dir, device: resolvedDevice, dtype: dtype ?? 'fp32' };

  const [processor, model] = await Promise.all([
    AutoProcessor.from_pretrained(modelName, { cache_dir }),
    AutoModel.from_pretrained(modelName, pretrainedOptions),
  ]);

  return {
    async run(task) {
      if (task.type !== 'embedImages') {
        throw new Error(`Unknown visual-embedder task type "${task.type}".`);
      }
      const images = await Promise.all(task.images.map(loadRawImage));
      const inputs = await processor(images);
      const output = await model(inputs);
      // DINOv3-class models expose only last_hidden_state ([n, seq, dim]);
      // the CLS token (sequence index 0) is the conventional global image
      // representation. If a model exposes pooler_output directly, prefer it.
      const rows = output.pooler_output
        ? tensorToRows(output.pooler_output)
        : clsTokenRows(output.last_hidden_state);
      return l2NormalizeRows(rows);
    },
    async dispose() {
      await model.dispose?.();
    },
  };
}

function l2NormalizeRows(matrix) {
  return matrix.map((row) => {
    const norm = Math.sqrt(row.reduce((sum, v) => sum + v * v, 0)) || 1;
    return row.map((v) => v / norm);
  });
}

function tensorToRows(tensor) {
  const [n, dim] = tensor.dims;
  const data = tensor.data;
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(Array.from(data.slice(i * dim, (i + 1) * dim)));
  }
  return rows;
}

function clsTokenRows(tensor) {
  const [n, seq, dim] = tensor.dims;
  const data = tensor.data;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const offset = i * seq * dim; // sequence index 0 (CLS token)
    rows.push(Array.from(data.slice(offset, offset + dim)));
  }
  return rows;
}
