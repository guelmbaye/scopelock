import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.js";
import { SAMPLE_PLAN, SAMPLE_DIFF } from "../public/sample.js";

// The model is always a mock: these tests never reach the Anthropic API.
let proposal = null;
let calls = 0;
const model = {
  async propose() {
    calls++;
    if (proposal instanceof Error) throw proposal;
    return structuredClone(proposal);
  },
};

let server;
let base;
before(async () => {
  server = createApp({ model, log: { error() {} } }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (body, raw = false) =>
  fetch(`${base}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? body : JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.json() }));

const sample = { plan: SAMPLE_PLAN, diff: SAMPLE_DIFF };

test("200: verified conflict", async () => {
  proposal = { verdict: "conflict", explanation: "Deferred.", evidence: { quote: "Export results as CSV", headingPath: ["Scope", "Later"] } };
  assert.deepEqual(await post(sample), {
    status: 200,
    body: { status: "verdict", verdict: "conflict", explanation: "Deferred.", evidence: { quote: "Export results as CSV", path: ["Scope", "Later"] }, evidenceCheck: null },
  });
});

test("200: rejected evidence becomes unplanned with evidenceCheck", async () => {
  proposal = { verdict: "aligned", explanation: "x", evidence: { quote: "Export results as CSV", headingPath: ["Scope", "Now"] } };
  const { status, body } = await post(sample);
  assert.equal(status, 200);
  assert.equal(body.verdict, "unplanned");
  assert.equal(body.evidence, null);
  assert.deepEqual(body.evidenceCheck, {
    proposedQuote: "Export results as CSV",
    claimedPath: ["Scope", "Now"],
    reason: "wrong_path",
    foundPaths: [["Scope", "Later"]],
  });
});

test("200: unplanned with no evidence", async () => {
  proposal = { verdict: "unplanned", explanation: "Nothing governs this.", evidence: null };
  assert.deepEqual((await post(sample)).body, { status: "verdict", verdict: "unplanned", explanation: "Nothing governs this.", evidence: null, evidenceCheck: null });
});

test("400: missing or whitespace-only inputs, and the model is not called", async () => {
  const before = calls;
  for (const [body, missing] of [
    [{ plan: "", diff: SAMPLE_DIFF }, ["plan"]],
    [{ plan: SAMPLE_PLAN, diff: " \n\t" }, ["diff"]],
    [{}, ["plan", "diff"]],
    [{ plan: 42, diff: ["x"] }, ["plan", "diff"]],
  ]) {
    assert.deepEqual(await post(body), { status: 400, body: { status: "invalid_input", missing } });
  }
  assert.equal(calls, before);
});

test("400: malformed JSON body", async () => {
  assert.deepEqual(await post("{not json", true), { status: 400, body: { status: "invalid_input", missing: [] } });
});

test("502: model/API failure is check_failed, never unplanned", async () => {
  proposal = new Error("API down");
  assert.deepEqual(await post(sample), { status: 502, body: { status: "check_failed" } });
});

test("502: structurally invalid proposal is check_failed", async () => {
  proposal = { verdict: "conflict", explanation: "x", evidence: null };
  assert.deepEqual(await post(sample), { status: 502, body: { status: "check_failed" } });
});

test("static page and modules are served", async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Check Alignment/);
  for (const file of ["app.js", "state.js", "sample.js", "styles.css"]) {
    assert.equal((await fetch(`${base}/${file}`)).status, 200, file);
  }
});
