// UI controller: feeds events to the state machine (state.js), renders, and sends requests.
// It never interprets plan text. Spec: spec.md > Components > UI controller.

import { SAMPLE_PLAN, SAMPLE_DIFF } from "./sample.js";
import { initialState, reduce, isLocked, qualityLabel, resultView } from "./state.js";

const planPane = document.getElementById("plan");
const diffPane = document.getElementById("diff");
const checkButton = document.getElementById("check");
const loadSampleButton = document.getElementById("load-sample");
const planRequired = document.getElementById("plan-required");
const diffRequired = document.getElementById("diff-required");
const qualityEl = document.getElementById("quality-label");
const resultEl = document.getElementById("result");
const resultBody = document.getElementById("result-body");

let state = initialState();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderQuality() {
  const label = qualityLabel(diffPane.value);
  qualityEl.dataset.kind = label.kind;
  qualityEl.replaceChildren(el("span", "quality-title", label.title));
  if (label.detail) qualityEl.append(el("span", "quality-detail", label.detail));
}

function renderResult() {
  const view = resultView(state);
  resultEl.dataset.state = state.name;
  delete resultEl.dataset.verdict;
  resultBody.replaceChildren();

  if (view.kind === "status") {
    resultBody.append(el("p", "status", view.text));
    if (view.detail) resultBody.append(el("p", "status-detail", view.detail));
  } else if (view.kind === "failed") {
    const retry = el("button", "ghost retry", "Try again");
    retry.type = "button";
    retry.addEventListener("click", () => dispatch({ type: "retry", plan: planPane.value, diff: diffPane.value }));
    resultBody.append(el("p", "status", view.text), retry);
  } else if (view.kind === "verdict") {
    resultEl.dataset.verdict = view.verdict;
    const line = el("p", "verdict-line");
    line.append(el("span", "verdict-word", view.word), el("span", "chip", view.action));
    resultBody.append(line, el("p", "explanation", view.explanation));

    const box = el("div", "evidence");
    box.append(el("h3", null, "Evidence"));
    if (view.evidence) box.append(el("p", "quote", view.evidence.quote), el("p", "location", view.evidence.location));
    if (view.noEvidence) box.append(el("p", "none", view.noEvidence));
    if (view.evidence || view.noEvidence) resultBody.append(box);

    if (view.evidenceCheck) {
      const note = el("div", "evidence-check");
      note.append(
        el("h3", null, "Evidence check"),
        el("p", "quote", view.evidenceCheck.proposed),
        el("p", "location", view.evidenceCheck.claimed),
        el("p", "rejected", view.evidenceCheck.rejected),
      );
      resultBody.append(note);
    }
  }
}

function render() {
  const locked = isLocked(state);
  for (const control of [planPane, diffPane, checkButton, loadSampleButton]) control.disabled = locked;
  planRequired.hidden = !state.missing.plan;
  diffRequired.hidden = !state.missing.diff;
  renderQuality();
  renderResult();
}

async function send(snapshot) {
  let event;
  try {
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    event = { type: "response", ok: res.ok, body: await res.json().catch(() => null) };
  } catch {
    event = { type: "response", ok: false, body: null };
  }
  dispatch(event);
}

function dispatch(event) {
  const { state: next, request } = reduce(state, event);
  state = next;
  render();
  if (request) send(request);
}

const edit = () => dispatch({ type: "edit", plan: planPane.value, diff: diffPane.value });

planPane.addEventListener("input", edit);
diffPane.addEventListener("input", edit);
checkButton.addEventListener("click", () => dispatch({ type: "check", plan: planPane.value, diff: diffPane.value }));
loadSampleButton.addEventListener("click", () => {
  planPane.value = SAMPLE_PLAN;
  diffPane.value = SAMPLE_DIFF;
  dispatch({ type: "loadSample" });
});

planPane.value = SAMPLE_PLAN;
diffPane.value = SAMPLE_DIFF;
render();
