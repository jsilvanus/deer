export function estimateTokensFromChars(chars: string) {
  return Math.max(1, Math.ceil((chars || '').length / 4));
}

export function trimEvidenceForBudget(prelude: string, evidence: any[] = [], allowedContext = 2048) {
  if (!Array.isArray(evidence) || evidence.length === 0) return [];
  const preludeLen = String(prelude || '').length;
  const serialized = evidence.map((e) => {
    const excerpt = String(e.excerpt || '');
    const src = String(e.source || '');
    return { e, len: 3 + String(e.id).length + src.length + excerpt.length };
  });

  const out: any[] = [];
  let running = preludeLen;
  for (const item of serialized) {
    running += item.len;
    if (running > allowedContext) break;
    out.push(item.e);
  }

  if (out.length === 0 && evidence.length > 0) {
    const first = { ...evidence[evidence.length - 1] };
    first.excerpt = String(first.excerpt || '').slice(0, Math.max(20, allowedContext / 4));
    return [first];
  }
  return out;
}

export default { estimateTokensFromChars, trimEvidenceForBudget };
