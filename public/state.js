// Pure result-state machine and result copy. No DOM, so the tests can drive it directly.
// app.js feeds it events and renders what it returns. Spec: spec.md > Components > UI controller.

import { SAMPLE_DIFF } from "./sample.js";

export const ACTIONS = { aligned: "Proceed", unplanned: "Review plan", conflict: "Stop" };

const NO_MISSING = Object.freeze({ plan: false, diff: false });
const blank = (s) => s.trim() === "";
const missingOf = ({ plan, diff }) => ({ plan: blank(plan), diff: blank(diff) });

export function initialState() {
  return { name: "ready", response: null, missing: NO_MISSING };
}

// Every event returns { state, request }. `request` is the exact snapshot to send, or null.
export function reduce(state, event) {
  const same = { state, request: null };

  switch (event.type) {
    case "loadSample":
      return { state: initialState(), request: null };

    case "check":
    case "retry": {
      if (state.name === "checking") return same;
      if (event.type === "retry" && state.name !== "failed") return same;
      const inputs = { plan: event.plan, diff: event.diff };
      const missing = missingOf(inputs);
      if (missing.plan || missing.diff) {
        return { state: { name: "notChecked", response: null, missing }, request: null };
      }
      return { state: { name: "checking", response: null, missing: NO_MISSING }, request: inputs };
    }

    case "response": {
      if (state.name !== "checking") return same;
      const body = event.body;
      const valid = event.ok && body?.status === "verdict" && Object.hasOwn(ACTIONS, body.verdict);
      return {
        state: valid
          ? { name: "verdict", response: body, missing: NO_MISSING }
          : { name: "failed", response: null, missing: NO_MISSING },
        request: null,
      };
    }

    case "edit": {
      const missing = missingOf(event);
      if (state.name === "verdict" || state.name === "outdated") {
        // Emptying a pane takes precedence over the outdated state.
        if (missing.plan || missing.diff) return { state: { name: "notChecked", response: null, missing }, request: null };
        return { state: { name: "outdated", response: null, missing: NO_MISSING }, request: null };
      }
      if (state.name === "notChecked") {
        // Clear a pane's required message once it is non-empty; never add new ones on edit.
        const next = { plan: state.missing.plan && missing.plan, diff: state.missing.diff && missing.diff };
        return { state: { ...state, missing: next }, request: null };
      }
      return same; // ready, failed, checking: edits don't change the state
    }

    default:
      return same;
  }
}

export const isLocked = (state) => state.name === "checking";

export function qualityLabel(diff) {
  return diff === SAMPLE_DIFF
    ? {
        kind: "sample",
        title: "Sample scenario · known-working change",
        detail: "Technical quality is intentionally assumed for this demo; SCOPELOCK only checks whether the change belongs to the plan.",
      }
    : { kind: "notEvaluated", title: "Technical quality: not evaluated", detail: "" };
}

const showPath = (path) => path.join(" > ");

export function evidenceCheckView(check) {
  const rejected =
    check.reason === "wrong_path"
      ? `Rejected: quote found under ${check.foundPaths.map(showPath).join(" and ")}, not under the claimed location.`
      : "Rejected: quote not found verbatim as a complete planning line.";
  return {
    proposed: `Proposed quote: "${check.proposedQuote}"`,
    claimed: `Claimed location: ${showPath(check.claimedPath) || "(no heading)"}`,
    rejected,
  };
}

// What the result area shows, derived only from the current state.
export function resultView(state) {
  switch (state.name) {
    case "ready":
      return { kind: "status", text: "Ready to check" };
    case "checking":
      return { kind: "status", text: "Checking…" };
    case "notChecked":
      return { kind: "status", text: "Not checked" };
    case "outdated":
      return {
        kind: "status",
        text: "Inputs changed — check again.",
        detail: "The previous result no longer applies to the current inputs.",
      };
    case "failed":
      return {
        kind: "failed",
        text: "Check failed. SCOPELOCK couldn't complete the analysis. Your inputs are unchanged.",
        retry: true,
      };
    case "verdict": {
      const { verdict, explanation, evidence, evidenceCheck } = state.response;
      return {
        kind: "verdict",
        verdict,
        word: verdict.toUpperCase(),
        action: ACTIONS[verdict],
        explanation,
        evidence: evidence ? { quote: `"${evidence.quote}"`, location: `Location: ${showPath(evidence.path)}` } : null,
        noEvidence: !evidence && !evidenceCheck ? "No relevant planning decision was found for this change." : null,
        evidenceCheck: evidenceCheck ? evidenceCheckView(evidenceCheck) : null,
      };
    }
    default:
      return { kind: "status", text: "" };
  }
}
