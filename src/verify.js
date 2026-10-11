// Decides whether proposed evidence counts: the quote must equal one entire block
// (after whitespace normalization) under exactly the claimed heading path.
// Rules: spec.md > Components > Verifier.

import { parsePlan, normalize } from "./markdown-blocks.js";

const samePath = (a, b) => a.length === b.length && a.every((label, i) => label === b[i]);

export function verifyEvidence(plan, { quote, headingPath }) {
  const q = normalize(quote);
  const claimed = headingPath.map(normalize);
  const matches = parsePlan(plan).filter((block) => normalize(block.text) === q);

  if (matches.length === 0) {
    return { ok: false, reason: "quote_not_found", foundPaths: [] };
  }
  if (matches.some((block) => samePath(block.path, claimed))) {
    return { ok: true };
  }

  const foundPaths = [];
  for (const { path } of matches) {
    if (!foundPaths.some((p) => samePath(p, path))) foundPaths.push(path);
  }
  return { ok: false, reason: "wrong_path", foundPaths };
}
