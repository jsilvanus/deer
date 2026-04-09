#!/usr/bin/env node
import Explainer from './explainer.js';

const mockAdapter = {
  modelName: 'mock-cli',
  generate: async (prompt, opts) => {
    return { text: JSON.stringify({
      explanation: 'CLI demo explanation [1]',
      labels: [],
      references: [{ id: 1, source: 'demo', claim: 'example' }],
      meta: {}
    }) };
  }
};

async function main() {
  const expl = new Explainer(mockAdapter, { deterministic: true });
  const req = {
    task: 'narrate',
    domain: 'demo',
    context: {},
    evidence: [{ id: 1, source: 'demo', excerpt: 'demo evidence' }],
    maxTokens: 128,
  };

  const res = await expl.explain(req);
  console.log(JSON.stringify(res, null, 2));
  await expl.destroy();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
