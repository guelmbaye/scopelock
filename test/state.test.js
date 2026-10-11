import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, reduce, isLocked, qualityLabel, resultView } from "../public/state.js";
import { SAMPLE_PLAN, SAMPLE_DIFF } from "../public/sample.js";
import { FLIPPED_PLAN } from "./fixtures/validation-cases.js";

const sample = { plan: SAMPLE_PLAN, diff: SAMPLE_DIFF };
const conflict = {
  status: "verdict",
  verdict: "conflict",
  explanation: "Deferred under Later.",
  evidence: { quote: "Export results as CSV", path: ["Scope", "Later"] },
  evidenceCheck: null,
};

// Run a sequence of events; collect every request the machine asks to send.
function run(events, start = initialState()) {
  let state = start;
  const requests = [];
  for (const event of events) {
    const out = reduce(state, event);
    state = out.state;
    if (out.request) requests.push(out.request);
  }
  return { state, requests };
}

const toVerdict = (body = conflict) => [{ type: "check", ...sample }, { type: "response", ok: true, body }];
const clean = { plan: false, diff: false };

test("first load is ready with no verdict", () => {
  const s = initialState();
  assert.equal(s.name, "ready");
  assert.equal(s.response, null);
  assert.deepEqual(resultView(s), { kind: "status", text: "Ready to check" });
});

test("check sends exactly the current inputs and locks the controls", () => {
  const { state, requests } = run([{ type: "check", ...sample }]);
  assert.equal(state.name, "checking");
  assert.equal(isLocked(state), true);
  assert.deepEqual(requests, [sample]);
  assert.equal(resultView(state).text, "Checking…");
});

test("a 200 verdict shows verdict, action, explanation and evidence", () => {
  const { state } = run(toVerdict());
  assert.equal(isLocked(state), false);
  assert.deepEqual(resultView(state), {
    kind: "verdict",
    verdict: "conflict",
    word: "CONFLICT",
    action: "Stop",
    explanation: "Deferred under Later.",
    evidence: { quote: '"Export results as CSV"', location: "Location: Scope > Later" },
    noEvidence: null,
    evidenceCheck: null,
  });
});

// --- Empty input: no request ---

test("check with an empty pane makes no request and shows Not checked + required message", () => {
  for (const [plan, diff, missing] of [
    ["", SAMPLE_DIFF, { plan: true, diff: false }],
    [SAMPLE_PLAN, "  \n\t", { plan: false, diff: true }],
    ["", "", { plan: true, diff: true }],
  ]) {
    const { state, requests } = run([{ type: "check", plan, diff }]);
    assert.deepEqual(requests, []);
    assert.equal(state.name, "notChecked");
    assert.deepEqual(state.missing, missing);
    assert.equal(resultView(state).text, "Not checked");
  }
});

test("in Not checked, a pane's required message clears once it is non-empty; no request", () => {
  const { state, requests } = run([
    { type: "check", plan: "", diff: "" },
    { type: "edit", plan: "# A", diff: "" },
  ]);
  assert.deepEqual(requests, []);
  assert.equal(state.name, "notChecked");
  assert.deepEqual(state.missing, { plan: false, diff: true });
});

// --- Outdated: edits after a verdict ---

test("any non-empty edit after a verdict removes the verdict and evidence and shows Inputs changed", () => {
  const { state, requests } = run([...toVerdict(), { type: "edit", plan: FLIPPED_PLAN, diff: SAMPLE_DIFF }]);
  assert.equal(state.name, "outdated");
  assert.equal(state.response, null);
  assert.deepEqual(requests, [sample]); // only the original check; no auto-rerun
  const view = resultView(state);
  assert.equal(view.text, "Inputs changed — check again.");
  assert.equal(view.detail, "The previous result no longer applies to the current inputs.");
  assert.equal(view.evidence, undefined);
});

test("emptying a pane after a verdict shows Not checked, taking precedence over outdated", () => {
  for (const start of [toVerdict(), [...toVerdict(), { type: "edit", plan: FLIPPED_PLAN, diff: SAMPLE_DIFF }]]) {
    const { state, requests } = run([...start, { type: "edit", plan: SAMPLE_PLAN, diff: "" }]);
    assert.equal(state.name, "notChecked");
    assert.equal(state.response, null);
    assert.deepEqual(state.missing, { plan: false, diff: true });
    assert.equal(requests.length, 1);
  }
});

test("edits in ready and failed don't change the state", () => {
  assert.equal(run([{ type: "edit", plan: "x", diff: "y" }]).state.name, "ready");
  const failed = run([{ type: "check", ...sample }, { type: "response", ok: false, body: { status: "check_failed" } }]).state;
  assert.equal(run([{ type: "edit", plan: "x", diff: "y" }], failed).state.name, "failed");
});

test("checking again after an edit sends the edited inputs and shows the new verdict", () => {
  const aligned = { ...conflict, verdict: "aligned", evidence: { quote: "Export results as CSV", path: ["Scope", "Now"] } };
  const { state, requests } = run([
    ...toVerdict(),
    { type: "edit", plan: FLIPPED_PLAN, diff: SAMPLE_DIFF },
    { type: "check", plan: FLIPPED_PLAN, diff: SAMPLE_DIFF },
    { type: "response", ok: true, body: aligned },
  ]);
  assert.deepEqual(requests, [sample, { plan: FLIPPED_PLAN, diff: SAMPLE_DIFF }]);
  assert.equal(resultView(state).word, "ALIGNED");
  assert.equal(resultView(state).action, "Proceed");
  assert.equal(resultView(state).evidence.location, "Location: Scope > Now");
});

// --- Failure and retry ---

test("API, network or malformed responses show Check failed with Try again, never a verdict", () => {
  for (const response of [
    { ok: false, body: { status: "check_failed" } },
    { ok: false, body: null },
    { ok: true, body: { status: "verdict", verdict: "maybe" } },
    { ok: true, body: null },
  ]) {
    const { state } = run([{ type: "check", ...sample }, { type: "response", ...response }]);
    assert.equal(state.name, "failed");
    assert.equal(state.response, null);
    const view = resultView(state);
    assert.equal(view.kind, "failed");
    assert.equal(view.text, "Check failed. SCOPELOCK couldn't complete the analysis. Your inputs are unchanged.");
    assert.equal(view.retry, true);
    assert.equal(view.verdict, undefined);
  }
});

test("Try again reruns the current inputs, not the sample or an older snapshot", () => {
  const custom = { plan: "# Plan\n## Now\n- Custom decision", diff: "diff --git a/x b/x\n+custom" };
  const { state, requests } = run([
    { type: "check", ...sample },
    { type: "response", ok: true, body: conflict },
    { type: "edit", ...custom },
    { type: "check", ...custom },
    { type: "response", ok: false, body: { status: "check_failed" } },
    { type: "retry", ...custom },
  ]);
  assert.equal(state.name, "checking");
  assert.deepEqual(requests, [sample, custom, custom]);
});

test("Try again after editing in the failed state sends the edited (current) inputs", () => {
  const edited = { plan: `${SAMPLE_PLAN}\n- one more`, diff: SAMPLE_DIFF };
  const { requests } = run([
    { type: "check", ...sample },
    { type: "response", ok: false, body: null },
    { type: "edit", ...edited },
    { type: "retry", ...edited },
  ]);
  assert.deepEqual(requests.at(-1), edited);
});

test("Try again is ignored outside the failed state; check is ignored while checking", () => {
  assert.deepEqual(run([{ type: "retry", ...sample }]).requests, []);
  assert.deepEqual(run([{ type: "check", ...sample }, { type: "check", ...sample }]).requests, [sample]);
});

// --- Load sample: complete reset ---

test("Load sample resets every state to Ready to check and clears validation, error and evidence", () => {
  const states = {
    verdict: run(toVerdict()).state,
    outdated: run([...toVerdict(), { type: "edit", plan: "x", diff: "y" }]).state,
    notChecked: run([{ type: "check", plan: "", diff: "" }]).state,
    failed: run([{ type: "check", ...sample }, { type: "response", ok: false, body: null }]).state,
    rejected: run(toVerdict({
      status: "verdict", verdict: "unplanned", explanation: "x", evidence: null,
      evidenceCheck: { proposedQuote: "q", claimedPath: ["A"], reason: "quote_not_found", foundPaths: [] },
    })).state,
  };
  for (const [name, start] of Object.entries(states)) {
    const { state, requests } = run([{ type: "loadSample" }], start);
    assert.deepEqual(state, initialState(), name);
    assert.deepEqual(state.missing, clean, name);
    assert.deepEqual(requests, [], name);
    assert.deepEqual(resultView(state), { kind: "status", text: "Ready to check" }, name);
  }
});

test("Load sample restores the sample technical-quality label", () => {
  assert.equal(qualityLabel(`${SAMPLE_DIFF}+edited\n`).kind, "notEvaluated");
  assert.deepEqual(qualityLabel(SAMPLE_DIFF), {
    kind: "sample",
    title: "Sample scenario · known-working change",
    detail: "Technical quality is intentionally assumed for this demo; SCOPELOCK only checks whether the change belongs to the plan.",
  });
});

// --- Technical-quality label ---

test("technical-quality label: sample only while the diff matches exactly", () => {
  assert.equal(qualityLabel(SAMPLE_DIFF).kind, "sample");
  for (const diff of [`${SAMPLE_DIFF} `, SAMPLE_DIFF.slice(1), "", "diff --git a/x b/x"]) {
    assert.deepEqual(qualityLabel(diff), { kind: "notEvaluated", title: "Technical quality: not evaluated", detail: "" });
  }
});

// --- Unplanned variants ---

test("unplanned with no evidence shows the no-decision line", () => {
  const { state } = run(toVerdict({ status: "verdict", verdict: "unplanned", explanation: "x", evidence: null, evidenceCheck: null }));
  const view = resultView(state);
  assert.equal(view.word, "UNPLANNED");
  assert.equal(view.action, "Review plan");
  assert.equal(view.noEvidence, "No relevant planning decision was found for this change.");
  assert.equal(view.evidenceCheck, null);
});

test("rejected evidence stays UNPLANNED · Review plan with a secondary Evidence check note", () => {
  const wrongPath = {
    status: "verdict", verdict: "unplanned", explanation: "x", evidence: null,
    evidenceCheck: { proposedQuote: "Export results as CSV", claimedPath: ["Scope", "Now"], reason: "wrong_path", foundPaths: [["Scope", "Later"]] },
  };
  const view = resultView(run(toVerdict(wrongPath)).state);
  assert.equal(view.word, "UNPLANNED");
  assert.equal(view.action, "Review plan");
  assert.equal(view.evidence, null);
  assert.equal(view.noEvidence, null);
  assert.deepEqual(view.evidenceCheck, {
    proposed: 'Proposed quote: "Export results as CSV"',
    claimed: "Claimed location: Scope > Now",
    rejected: "Rejected: quote found under Scope > Later, not under the claimed location.",
  });

  const notFound = { ...wrongPath, evidenceCheck: { ...wrongPath.evidenceCheck, proposedQuote: "Export results", reason: "quote_not_found", foundPaths: [] } };
  assert.equal(resultView(run(toVerdict(notFound)).state).evidenceCheck.rejected, "Rejected: quote not found verbatim as a complete planning line.");

  const twoPaths = { ...wrongPath, evidenceCheck: { ...wrongPath.evidenceCheck, claimedPath: ["Later"], foundPaths: [["Scope", "Later"], ["Roadmap", "Later"]] } };
  assert.equal(
    resultView(run(toVerdict(twoPaths)).state).evidenceCheck.rejected,
    "Rejected: quote found under Scope > Later and Roadmap > Later, not under the claimed location.",
  );
});
