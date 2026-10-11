// UI controller: owns the result state and renders it. It never interprets plan text.
// Spec: spec.md > Components > UI controller.

import { SAMPLE_PLAN, SAMPLE_DIFF } from "./sample.js";

const planPane = document.getElementById("plan");
const diffPane = document.getElementById("diff");
const checkButton = document.getElementById("check");
const loadSampleButton = document.getElementById("load-sample");
const resultEl = document.getElementById("result");
const resultBody = document.getElementById("result-body");

const ACTIONS = { aligned: "Proceed", unplanned: "Review plan", conflict: "Stop" };

let state = "ready";
let lastResponse = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setLocked(locked) {
  for (const control of [planPane, diffPane, checkButton, loadSampleButton]) control.disabled = locked;
}

function renderEvidence(response) {
  const box = el("div", "evidence");
  box.append(el("h3", null, "Evidence"));
  if (response.evidence) {
    box.append(
      el("p", "quote", `"${response.evidence.quote}"`),
      el("p", "location", `Location: ${response.evidence.path.join(" > ")}`),
    );
  } else {
    box.append(el("p", "none", "No relevant planning decision was found for this change."));
  }
  return box;
}

function render() {
  resultEl.dataset.state = state;
  delete resultEl.dataset.verdict;
  resultBody.replaceChildren();

  if (state === "ready") {
    resultBody.append(el("p", "status", "Ready to check"));
  } else if (state === "checking") {
    resultBody.append(el("p", "status", "Checking…"));
  } else if (state === "verdict") {
    const { verdict, explanation } = lastResponse;
    resultEl.dataset.verdict = verdict;
    const line = el("p", "verdict-line");
    line.append(el("span", "verdict-word", verdict.toUpperCase()), el("span", "chip", ACTIONS[verdict]));
    resultBody.append(line, el("p", "explanation", explanation), renderEvidence(lastResponse));
  } else if (state === "failed") {
    resultBody.append(el("p", "status", "Check failed. SCOPELOCK couldn't complete the analysis. Your inputs are unchanged."));
  }
}

function setState(next, response = null) {
  state = next;
  lastResponse = response;
  render();
}

function loadSample() {
  planPane.value = SAMPLE_PLAN;
  diffPane.value = SAMPLE_DIFF;
  setState("ready");
}

async function check() {
  const snapshot = { plan: planPane.value, diff: diffPane.value };
  if (!snapshot.plan.trim() || !snapshot.diff.trim()) return; // empty-input state arrives in slice 3

  setLocked(true);
  setState("checking");
  try {
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    const body = await res.json();
    if (res.ok && body.status === "verdict" && ACTIONS[body.verdict]) {
      setState("verdict", body);
    } else {
      setState("failed");
    }
  } catch {
    setState("failed");
  } finally {
    setLocked(false);
  }
}

checkButton.addEventListener("click", check);
loadSampleButton.addEventListener("click", loadSample);
loadSample();
