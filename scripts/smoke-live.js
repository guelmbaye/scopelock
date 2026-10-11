// npm run smoke: live model reliability check. Calls the real Anthropic API; never part of npm test.
// Runs validation cases 1, 2, 3 and 6 three times each through the real model.js + check.js.
// Spec: spec.md > Live Model Smoke Checks.

import { createModel } from "../src/model.js";
import { runCheck } from "../src/check.js";
import { verifyEvidence } from "../src/verify.js";
import { CASES } from "../test/fixtures/validation-cases.js";

const RUNS = 3;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set (put it in .env). Smoke checks need the live API.");
  process.exit(1);
}

const model = createModel({ apiKey: process.env.ANTHROPIC_API_KEY, modelName: process.env.ANTHROPIC_MODEL || undefined });

// Wrap the model to capture its raw proposal for reporting.
function recording(model) {
  let last = null;
  return {
    get last() { return last; },
    async propose(plan, diff) {
      last = null;
      try {
        last = await model.propose(plan, diff);
        return last;
      } catch (error) {
        last = { error: [error.constructor?.name, error.status, error.message].filter(Boolean).join(" ") };
        throw error;
      }
    },
  };
}

function passes(c, result) {
  if (result.status !== "verdict" || result.verdict !== c.expectFinal.verdict) return false;
  if (!c.expectFinal.evidence) return result.evidence === null;
  if (!result.evidence || result.evidence.quote !== c.expectFinal.evidence.quote) return false;
  // Case 6 has the same block under two headings; either verified location is correct.
  if (c.id === "6") return result.evidence.path.at(-1) === "Later";
  return JSON.stringify(result.evidence.path) === JSON.stringify(c.expectFinal.evidence.path);
}

async function runOne(c, run) {
  const rec = recording(model);
  const started = Date.now();
  const result = await runCheck({ plan: c.plan, diff: c.diff }, rec, { error() {} });
  const p = rec.last;
  const verification = p?.evidence ? verifyEvidence(c.plan, p.evidence) : null;
  return { c, run, ms: Date.now() - started, proposal: p, verification, result, ok: passes(c, result) };
}

const cases = CASES.filter((c) => c.live);
console.log(`Model: ${model.modelName} · cases ${cases.map((c) => c.id).join(", ")} × ${RUNS} runs\n`);

// Gate: one call first. If the API rejects the schema or the response is structurally
// invalid, stop here with the exact error instead of spending the remaining runs.
const first = await runOne(cases[0], 1);
if (first.proposal?.error || first.result.status !== "verdict") {
  console.error(`First call failed structurally (case ${cases[0].id} run 1): ${first.proposal?.error ?? first.result.status}`);
  process.exit(2);
}

const rows = [first];
for (let run = 1; run <= RUNS; run++) {
  const pending = run === 1 ? cases.slice(1) : cases;
  rows.push(...(await Promise.all(pending.map((c) => runOne(c, run)))));
}

rows.sort((a, b) => a.c.id.localeCompare(b.c.id) || a.run - b.run);
for (const r of rows) {
  const p = r.proposal;
  const proposed = p?.error
    ? `ERROR ${p.error}`
    : `${p.verdict}  quote=${JSON.stringify(p.evidence?.quote ?? null)}  path=${JSON.stringify(p.evidence?.headingPath ?? null)}`;
  const verified = r.verification ? (r.verification.ok ? "verified" : `rejected:${r.verification.reason}`) : "n/a";
  const final = r.result.status === "verdict" ? r.result.verdict : r.result.status;
  console.log(`case ${r.c.id} run ${r.run}  ${r.ok ? "PASS" : "FAIL"}  (${(r.ms / 1000).toFixed(1)}s)`);
  console.log(`  model:    ${proposed}`);
  console.log(`  verifier: ${verified}`);
  console.log(`  final:    ${final}  (expected ${r.c.expectFinal.verdict})`);
  if (p?.explanation) console.log(`  why:      ${p.explanation}`);
}

const canonical = rows.filter((r) => r.c.id === "1" || r.c.id === "2");
const canonicalPass = canonical.filter((r) => r.ok).length;
const allPass = rows.filter((r) => r.ok).length;
console.log(`\nCanonical flip test (cases 1, 2): ${canonicalPass}/${canonical.length}  ${canonicalPass === canonical.length ? "BAR MET" : "BAR MISSED"}`);
console.log(`All live cases: ${allPass}/${rows.length}`);
process.exit(canonicalPass === canonical.length ? 0 : 1);
