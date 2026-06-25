import { strict as assert } from 'assert';
import test from 'node:test';
import { renderTemplate } from '../dist/explainer-templates.js';

const ALL_DOMAINS = [
  'general', 'evolution', 'security', 'performance', 'docs',
  'api', 'ux', 'infra', 'legal', 'compliance', 'data', 'testing', 'architecture',
];

// ---------------------------------------------------------------------------
// Coverage of all 13 domains
// ---------------------------------------------------------------------------

test('renderTemplate returns a non-empty string for every known domain', () => {
  for (const domain of ALL_DOMAINS) {
    const result = renderTemplate(domain);
    assert.ok(
      typeof result === 'string' && result.length > 0,
      `expected a non-empty string for domain "${domain}", got: ${JSON.stringify(result)}`,
    );
  }
});

test('renderTemplate returns distinct templates for each domain', () => {
  const templates = ALL_DOMAINS.map((d) => renderTemplate(d));
  const unique = new Set(templates);
  assert.equal(
    unique.size,
    ALL_DOMAINS.length,
    'each domain should produce a unique template string',
  );
});

// ---------------------------------------------------------------------------
// Fallback behaviour
// ---------------------------------------------------------------------------

test('renderTemplate returns general template for undefined domain', () => {
  const general = renderTemplate('general');
  assert.equal(renderTemplate(undefined), general);
});

test('renderTemplate returns general template for unknown domain', () => {
  const general = renderTemplate('general');
  assert.equal(renderTemplate('not-a-real-domain'), general);
});

test('renderTemplate returns general template for empty string domain', () => {
  const general = renderTemplate('general');
  assert.equal(renderTemplate(''), general);
});

// ---------------------------------------------------------------------------
// Case-insensitivity
// ---------------------------------------------------------------------------

test('renderTemplate is case-insensitive', () => {
  const lower = renderTemplate('security');
  assert.equal(renderTemplate('SECURITY'), lower);
  assert.equal(renderTemplate('Security'), lower);
  assert.equal(renderTemplate('sEcUrItY'), lower);
});

// ---------------------------------------------------------------------------
// Spot-checks for template content relevance
// ---------------------------------------------------------------------------

test('security template references security concerns', () => {
  const result = renderTemplate('security');
  assert.ok(result.toLowerCase().includes('security'));
});

test('testing template references test cases', () => {
  const result = renderTemplate('testing');
  assert.ok(result.toLowerCase().includes('test'));
});

test('performance template references performance topics', () => {
  const result = renderTemplate('performance');
  assert.ok(result.toLowerCase().includes('performance'));
});

test('architecture template references architecture', () => {
  const result = renderTemplate('architecture');
  assert.ok(result.toLowerCase().includes('architecture'));
});

test('legal template references legal or risk topics', () => {
  const result = renderTemplate('legal');
  const lower = result.toLowerCase();
  assert.ok(lower.includes('legal') || lower.includes('risk'));
});
