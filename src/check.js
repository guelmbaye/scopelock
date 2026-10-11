// Orchestrator: model proposal -> verifier -> final response.
// It never re-interprets the verdict; it only downgrades a proposal whose evidence fails.
// Decision table: spec.md > Components > Orchestrator.

import { verifyEvidence } from "./verify.js";
import { normalize } from "./markdown-blocks.js";

export const REJECTED_EXPLANATION =
  "The proposed evidence couldn't be verified against the planning text, so no planning decision is treated as governing this change.";

const FAILED = { status: "check_failed" };
const isStringArray = (v) => Array.isArray(v) && v.every((s) => typeof s === "string");

export async function runCheck({ plan, diff }, model, log = console) {
  let proposal;
  try {
    proposal = await model.propose(plan, diff);
  } catch (error) {
    log.error?.(`check_failed: ${error.message}`);
    return FAILED;
  }

  const { verdict, explanation, evidence } = proposal ?? {};
  if (typeof explanation !== "string") return FAILED;

  if (verdict === "unplanned") {
    if (evidence !== null) return FAILED; // structurally invalid, never repaired
    return { status: "verdict", verdict, explanation, evidence: null, evidenceCheck: null };
  }

  if (verdict !== "aligned" && verdict !== "conflict") return FAILED;
  if (!evidence || typeof evidence.quote !== "string" || !isStringArray(evidence.headingPath)) {
    return FAILED; // structurally invalid, never repaired
  }

  const result = verifyEvidence(plan, evidence);
  if (result.ok) {
    return {
      status: "verdict",
      verdict,
      explanation,
      evidence: { quote: normalize(evidence.quote), path: evidence.headingPath.map(normalize) },
      evidenceCheck: null,
    };
  }
  return {
    status: "verdict",
    verdict: "unplanned",
    explanation: REJECTED_EXPLANATION,
    evidence: null,
    evidenceCheck: {
      proposedQuote: evidence.quote,
      claimedPath: evidence.headingPath,
      reason: result.reason,
      foundPaths: result.foundPaths,
    },
  };
}
