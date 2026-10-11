import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyEvidence } from "../src/verify.js";
import { CASES, DUPLICATE_HEADING_PLAN } from "./fixtures/validation-cases.js";
import { SAMPLE_PLAN } from "../public/sample.js";

for (const c of CASES.filter((c) => c.expectVerify)) {
  test(`case ${c.id}: ${c.name}`, () => {
    assert.deepEqual(verifyEvidence(c.plan, c.proposal.evidence), c.expectVerify);
  });
}

test("case 6: claiming only the nearest heading is a wrong path", () => {
  assert.deepEqual(
    verifyEvidence(DUPLICATE_HEADING_PLAN, { quote: "Export results as CSV", headingPath: ["Later"] }),
    { ok: false, reason: "wrong_path", foundPaths: [["Scope", "Later"], ["Roadmap", "Later"]] },
  );
});

test("whitespace differences in quote and path are normalized", () => {
  assert.deepEqual(
    verifyEvidence(SAMPLE_PLAN, { quote: "  Export   results\nas CSV ", headingPath: [" Scope", "Later  "] }),
    { ok: true },
  );
});

test("case, punctuation and inline Markdown are not normalized", () => {
  for (const quote of ["export results as csv", "Export results as CSV.", "**Export** results as CSV"]) {
    assert.equal(verifyEvidence(SAMPLE_PLAN, { quote, headingPath: ["Scope", "Later"] }).reason, "quote_not_found", quote);
  }
});

test("quotes cannot span two blocks", () => {
  const quote = "Export results as CSV Email a daily summary to the owner";
  assert.equal(verifyEvidence(SAMPLE_PLAN, { quote, headingPath: ["Scope", "Later"] }).reason, "quote_not_found");
});

test("heading text is not citable", () => {
  assert.equal(verifyEvidence(SAMPLE_PLAN, { quote: "Later", headingPath: ["Scope"] }).reason, "quote_not_found");
});

test("inline bold must be quoted with its Markdown kept", () => {
  const plan = "# Scope\n## Later\n- Export **all** results as CSV\n";
  assert.deepEqual(verifyEvidence(plan, { quote: "Export **all** results as CSV", headingPath: ["Scope", "Later"] }), { ok: true });
  assert.equal(verifyEvidence(plan, { quote: "Export all results as CSV", headingPath: ["Scope", "Later"] }).reason, "quote_not_found");
});

test("a path prefix or a longer path is not the claimed path", () => {
  assert.equal(verifyEvidence(SAMPLE_PLAN, { quote: "Export results as CSV", headingPath: ["Scope"] }).reason, "wrong_path");
  assert.equal(verifyEvidence(SAMPLE_PLAN, { quote: "Export results as CSV", headingPath: ["Scope", "Later", "X"] }).reason, "wrong_path");
});
