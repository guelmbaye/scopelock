// Validation set (spec.md > Validation Set): shared plans, diffs, mocked model
// proposals and expected outcomes. Unit tests use the mocks; the smoke script runs live.

import { SAMPLE_PLAN, SAMPLE_DIFF } from "../../public/sample.js";

const CSV_LINE = "- Export results as CSV\n";

// The flip-test edit: move the CSV line from Later to the end of Now.
export const FLIPPED_PLAN = SAMPLE_PLAN.replace(CSV_LINE, "").replace(
  "\n\n## Later",
  `\n${CSV_LINE.trimEnd()}\n\n## Later`,
);

export const UNRELATED_DIFF = `diff --git a/README.md b/README.md
index 3f2a1b0..8c4d5e6 100644
--- a/README.md
+++ b/README.md
@@ -1,4 +1,4 @@
 # Pollbox

-A tiny survey tol for asking one question.
+A tiny survey tool for asking one question.
`;

export const DUPLICATE_HEADING_PLAN = `# Scope

## Later
- Export results as CSV

# Roadmap

## Later
- Export results as CSV
`;

const proposal = (verdict, quote, headingPath) => ({
  verdict,
  explanation: `Mocked ${verdict} explanation.`,
  evidence: quote === null ? null : { quote, headingPath },
});

export const CASES = [
  {
    id: "1",
    name: "canonical sample, CSV under Later",
    plan: SAMPLE_PLAN,
    diff: SAMPLE_DIFF,
    proposal: proposal("conflict", "Export results as CSV", ["Scope", "Later"]),
    expectVerify: { ok: true },
    expectFinal: { verdict: "conflict", evidence: { quote: "Export results as CSV", path: ["Scope", "Later"] } },
    live: true,
  },
  {
    id: "2",
    name: "same line moved to Now, same diff",
    plan: FLIPPED_PLAN,
    diff: SAMPLE_DIFF,
    proposal: proposal("aligned", "Export results as CSV", ["Scope", "Now"]),
    expectVerify: { ok: true },
    expectFinal: { verdict: "aligned", evidence: { quote: "Export results as CSV", path: ["Scope", "Now"] } },
    live: true,
  },
  {
    id: "3",
    name: "unrelated diff (README typo fix)",
    plan: SAMPLE_PLAN,
    diff: UNRELATED_DIFF,
    proposal: proposal("unplanned", null),
    expectVerify: null, // nothing to verify
    expectFinal: { verdict: "unplanned", evidence: null, evidenceCheck: null },
    live: true,
  },
  {
    id: "4",
    name: "canonical sample, wrong path",
    plan: SAMPLE_PLAN,
    diff: SAMPLE_DIFF,
    proposal: proposal("conflict", "Export results as CSV", ["Scope", "Now"]),
    expectVerify: { ok: false, reason: "wrong_path", foundPaths: [["Scope", "Later"]] },
    expectFinal: { verdict: "unplanned", reason: "wrong_path" },
    live: false,
  },
  {
    id: "5a",
    name: "partial quote",
    plan: SAMPLE_PLAN,
    diff: SAMPLE_DIFF,
    proposal: proposal("conflict", "Export results", ["Scope", "Later"]),
    expectVerify: { ok: false, reason: "quote_not_found", foundPaths: [] },
    expectFinal: { verdict: "unplanned", reason: "quote_not_found" },
    live: false,
  },
  {
    id: "5b",
    name: "paraphrase",
    plan: SAMPLE_PLAN,
    diff: SAMPLE_DIFF,
    proposal: proposal("conflict", "CSV export of results", ["Scope", "Later"]),
    expectVerify: { ok: false, reason: "quote_not_found", foundPaths: [] },
    expectFinal: { verdict: "unplanned", reason: "quote_not_found" },
    live: false,
  },
  {
    id: "6",
    name: "same block under Scope > Later and Roadmap > Later",
    plan: DUPLICATE_HEADING_PLAN,
    diff: SAMPLE_DIFF,
    proposal: proposal("conflict", "Export results as CSV", ["Roadmap", "Later"]),
    expectVerify: { ok: true },
    expectFinal: { verdict: "conflict", evidence: { quote: "Export results as CSV", path: ["Roadmap", "Later"] } },
    live: true,
  },
];
