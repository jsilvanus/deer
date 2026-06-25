// Live tests download real models from the Hugging Face Hub and run real
// inference. They're excluded from `npm test` (test/*.test.js) and run via
// `npm run test:live`, since they're slow and need network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Captioner } from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAT_IMAGE = path.join(__dirname, '..', 'fixtures', 'cats.jpg');

test('Captioner: produces a caption for a single image', async () => {
  const captioner = await Captioner.create('Xenova/vit-gpt2-image-captioning', {
    mode: 'process',
    concurrency: 1,
  });
  try {
    const [caption] = await captioner.caption([CAT_IMAGE]);
    assert.equal(typeof caption, 'string');
    assert.ok(caption.length > 0);
  } finally {
    await captioner.destroy();
  }
});

test('Captioner: batches multiple images, one caption each in order', async () => {
  const captioner = await Captioner.create('Xenova/vit-gpt2-image-captioning', {
    mode: 'process',
    concurrency: 1,
  });
  try {
    const captions = await captioner.caption([CAT_IMAGE, CAT_IMAGE, CAT_IMAGE]);
    assert.equal(captions.length, 3);
    for (const caption of captions) {
      assert.equal(typeof caption, 'string');
      assert.ok(caption.length > 0);
    }
  } finally {
    await captioner.destroy();
  }
});
