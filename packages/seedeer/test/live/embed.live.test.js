// Live tests download real models from the Hugging Face Hub and run real
// inference. They're excluded from `npm test` (test/*.test.js) and run via
// `npm run test:live`, since they're slow and need network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JointEmbedder, VisualEmbedder } from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAT_IMAGE = path.join(__dirname, '..', 'fixtures', 'cats.jpg');

test('JointEmbedder: image and text land in a comparable, normalized space', async () => {
  const embedder = await JointEmbedder.create('Xenova/clip-vit-base-patch32', {
    mode: 'process',
    concurrency: 1,
  });
  try {
    const [imageVec] = await embedder.embedImages([CAT_IMAGE]);
    const [catVec, dogVec] = await embedder.embedText(['a photo of a cat', 'a photo of a dog']);

    assert.equal(imageVec.length, 512);
    assertApproxUnitNorm(imageVec);
    assertApproxUnitNorm(catVec);

    const simCat = cosine(imageVec, catVec);
    const simDog = cosine(imageVec, dogVec);
    assert.ok(simCat > simDog, `expected cat similarity (${simCat}) > dog similarity (${simDog})`);
  } finally {
    await embedder.destroy();
  }
});

test('VisualEmbedder: produces a normalized vision-only embedding', async () => {
  const embedder = await VisualEmbedder.create('Xenova/dinov2-small', {
    mode: 'process',
    concurrency: 1,
  });
  try {
    const [vec] = await embedder.embedImages([CAT_IMAGE]);
    assert.equal(vec.length, 384);
    assertApproxUnitNorm(vec);
  } finally {
    await embedder.destroy();
  }
});

function cosine(a, b) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

function assertApproxUnitNorm(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  assert.ok(Math.abs(norm - 1) < 1e-4, `expected unit norm, got ${norm}`);
}
