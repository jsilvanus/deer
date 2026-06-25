import { strict as assert } from 'assert';
import test from 'node:test';
import { estimateTokensFromChars, trimEvidenceForBudget } from '../dist/prompt-utils.js';

// ---------------------------------------------------------------------------
// estimateTokensFromChars
// ---------------------------------------------------------------------------

test('estimateTokensFromChars returns 1 for empty string', () => {
  assert.equal(estimateTokensFromChars(''), 1);
});

test('estimateTokensFromChars returns 1 for a 4-character string', () => {
  assert.equal(estimateTokensFromChars('abcd'), 1);
});

test('estimateTokensFromChars returns 2 for an 8-character string', () => {
  assert.equal(estimateTokensFromChars('aaaabbbb'), 2);
});

test('estimateTokensFromChars rounds up partial tokens', () => {
  // 5 chars → ceil(5/4) = 2
  assert.equal(estimateTokensFromChars('abcde'), 2);
  // 7 chars → ceil(7/4) = 2
  assert.equal(estimateTokensFromChars('abcdefg'), 2);
});

test('estimateTokensFromChars returns 25 for a 100-character string', () => {
  assert.equal(estimateTokensFromChars('a'.repeat(100)), 25);
});

test('estimateTokensFromChars returns at least 1 even for a 1-character string', () => {
  assert.equal(estimateTokensFromChars('x'), 1);
});

// ---------------------------------------------------------------------------
// trimEvidenceForBudget — empty / non-array inputs
// ---------------------------------------------------------------------------

test('trimEvidenceForBudget returns [] for empty evidence array', () => {
  assert.deepEqual(trimEvidenceForBudget('prelude', [], 2048), []);
});

test('trimEvidenceForBudget returns [] for null evidence', () => {
  assert.deepEqual(trimEvidenceForBudget('prelude', null, 2048), []);
});

test('trimEvidenceForBudget returns [] for undefined evidence', () => {
  assert.deepEqual(trimEvidenceForBudget('prelude', undefined, 2048), []);
});

// ---------------------------------------------------------------------------
// trimEvidenceForBudget — budget fits all items
// ---------------------------------------------------------------------------

test('trimEvidenceForBudget includes all evidence when budget is very large', () => {
  const evidence = [
    { id: 1, source: 'a.js', excerpt: 'short excerpt one' },
    { id: 2, source: 'b.js', excerpt: 'short excerpt two' },
    { id: 3, source: 'c.js', excerpt: 'short excerpt three' },
  ];
  const result = trimEvidenceForBudget('', evidence, 1_000_000);
  assert.equal(result.length, 3);
});

test('trimEvidenceForBudget preserves original evidence order', () => {
  const evidence = [
    { id: 1, source: 'a.js', excerpt: 'first' },
    { id: 2, source: 'b.js', excerpt: 'second' },
    { id: 3, source: 'c.js', excerpt: 'third' },
  ];
  const result = trimEvidenceForBudget('', evidence, 1_000_000);
  assert.equal(result[0].id, 1);
  assert.equal(result[1].id, 2);
  assert.equal(result[2].id, 3);
});

// ---------------------------------------------------------------------------
// trimEvidenceForBudget — budget trimming
// ---------------------------------------------------------------------------

test('trimEvidenceForBudget trims evidence items that exceed the budget', () => {
  const long = 'x'.repeat(500);
  const evidence = [
    { id: 1, source: 'a.js', excerpt: long },
    { id: 2, source: 'b.js', excerpt: long },
    { id: 3, source: 'c.js', excerpt: long },
  ];
  // Budget of 600 — the prelude is empty, but each item takes ~505 chars.
  // Only the first item should fit.
  const result = trimEvidenceForBudget('', evidence, 600);
  assert.ok(result.length < 3, `expected fewer than 3 items, got ${result.length}`);
});

test('trimEvidenceForBudget returns the first item (truncated) when nothing fits', () => {
  const evidence = [{ id: 1, source: 'huge.js', excerpt: 'y'.repeat(5000) }];
  // Budget is tiny relative to evidence length
  const result = trimEvidenceForBudget('x'.repeat(2000), evidence, 10);
  assert.equal(result.length, 1);
  // The excerpt must be shorter than the original
  assert.ok(result[0].excerpt.length < 5000, 'excerpt should be truncated');
});

test('trimEvidenceForBudget uses last evidence item as fallback when nothing fits', () => {
  const evidence = [
    { id: 1, source: 'a.js', excerpt: 'z'.repeat(5000) },
    { id: 2, source: 'b.js', excerpt: 'w'.repeat(5000) },
  ];
  // Budget far too small
  const result = trimEvidenceForBudget('x'.repeat(5000), evidence, 1);
  assert.equal(result.length, 1);
  // Should be the last item (id: 2) per the implementation
  assert.equal(result[0].id, 2);
});

// ---------------------------------------------------------------------------
// trimEvidenceForBudget — prelude length is accounted for
// ---------------------------------------------------------------------------

test('trimEvidenceForBudget accounts for prelude length when calculating budget', () => {
  const evidence = [
    { id: 1, source: 'a.js', excerpt: 'short' },
    { id: 2, source: 'b.js', excerpt: 'short' },
  ];
  // A very large prelude should leave little room for evidence
  const largePrelude = 'p'.repeat(10_000);
  const result = trimEvidenceForBudget(largePrelude, evidence, 10_010);
  // Only the first item (or none) should fit, not both
  assert.ok(result.length <= 1);
});
