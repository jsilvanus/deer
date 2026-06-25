import { resolveDevice } from '../shared/provider-loader.js';
import { defaultCacheDir } from '../shared/cache-dir.js';
import { loadRawImage } from '../shared/image-input.js';

/**
 * Engine module loaded by WorkerPool workers for LocalVqaBackend. Not
 * meant to be imported by consumers directly — go through VqaAssistant.
 */
export async function createEngine({ modelName, device, provider, cacheDir, dtype }) {
  const { AutoProcessor, AutoModelForVision2Seq } = await import('@huggingface/transformers');
  const resolvedDevice = resolveDevice({ device, provider });
  const cache_dir = cacheDir ?? defaultCacheDir();

  const processor = await AutoProcessor.from_pretrained(modelName, { cache_dir });
  const model = await AutoModelForVision2Seq.from_pretrained(modelName, {
    cache_dir,
    device: resolvedDevice,
    dtype: dtype ?? 'fp32',
  });

  return {
    async run(task) {
      if (task.type !== 'ask') {
        throw new Error(`Unknown VQA task type "${task.type}".`);
      }
      const image = await loadRawImage(task.image);
      const messages = [
        {
          role: 'user',
          content: [{ type: 'image' }, { type: 'text', text: task.question }],
        },
      ];
      const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
      const inputs = await processor(prompt, image);

      const generated = await model.generate({
        ...inputs,
        max_new_tokens: task.maxNewTokens ?? 100,
      });
      const newTokens = generated.slice(null, [inputs.input_ids.dims[1], null]);
      const [answer] = processor.batch_decode(newTokens, { skip_special_tokens: true });
      return answer.trim();
    },
    async dispose() {
      await model.dispose?.();
    },
  };
}
