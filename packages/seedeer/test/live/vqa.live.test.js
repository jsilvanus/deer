// Live tests download real models from the Hugging Face Hub and run real
// inference. They're excluded from `npm test` (test/*.test.js) and run via
// `npm run test:live`, since they're slow and need network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VqaAssistant } from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAT_IMAGE = path.join(__dirname, '..', 'fixtures', 'cats.jpg');

test('VqaAssistant (local backend): answers a question about an image', async () => {
  const vqa = await VqaAssistant.create({
    backend: 'local',
    mode: 'process',
    concurrency: 1,
  });
  try {
    const answer = await vqa.ask(CAT_IMAGE, 'What animals are in this image?');
    assert.equal(typeof answer, 'string');
    assert.ok(answer.length > 0);
    assert.match(answer.toLowerCase(), /cat/);
  } finally {
    await vqa.destroy();
  }
});
