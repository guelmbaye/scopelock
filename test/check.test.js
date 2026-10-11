import { test } from "node:test";
import assert from "node:assert/strict";
import { runCheck, REJECTED_EXPLANATION } from "../src/check.js";
import { createModel, proposalFormat } from "../src/model.js";
import { CASES } from "./fixtures/validation-cases.js";
import { SAMPLE_PLAN, SAMPLE_DIFF } from "../public/sample.js";

const quiet = { error() {} };
const mockModel = (proposal) => ({ propose: async () => structuredClone(proposal) });
const input = { plan: SAMPLE_PLAN, diff: SAMPLE_DIFF };

// A fake SDK client: lets the real model adapter run with no network.
const fakeClient = (message) => {
  const calls = [];
  return {
    calls,
    messages: {
      parse: async (params) => {
        calls.push(params);
        return message;
      },
    },
  };
};
const reply = (proposal, stop_reason = "end_turn") => ({ stop_reason, parsed_output: proposal === undefined ? null : { proposal } });

// --- Decision table, driven by the validation set ---

for (const c of CASES) {
  test(`case ${c.id}: ${c.name} -> ${c.expectFinal.verdict}`, async () => {
    const result = await runCheck({ plan: c.plan, diff: c.diff }, mockModel(c.proposal), quiet);
    assert.equal(result.status, "verdict");
    assert.equal(result.verdict, c.expectFinal.verdict);
    if (c.expectFinal.evidence) {
      assert.deepEqual(result.evidence, c.expectFinal.evidence);
      assert.equal(result.evidenceCheck, null);
      assert.equal(result.explanation, c.proposal.explanation);
    } else if (c.expectFinal.reason) {
      assert.equal(result.evidence, null);
      assert.equal(result.explanation, REJECTED_EXPLANATION);
      assert.deepEqual(result.evidenceCheck, {
        proposedQuote: c.proposal.evidence.quote,
        claimedPath: c.proposal.evidence.headingPath,
        reason: c.expectVerify.reason,
        foundPaths: c.expectVerify.foundPaths,
      });
    } else {
      assert.equal(result.evidence, null);
      assert.equal(result.evidenceCheck, null);
    }
  });
}

test("aligned/conflict with null evidence -> check_failed (not repaired)", async () => {
  for (const verdict of ["aligned", "conflict"]) {
    const result = await runCheck(input, mockModel({ verdict, explanation: "x", evidence: null }), quiet);
    assert.deepEqual(result, { status: "check_failed" });
  }
});

test("unplanned with non-null evidence -> check_failed (not repaired)", async () => {
  const proposal = { verdict: "unplanned", explanation: "x", evidence: { quote: "Export results as CSV", headingPath: ["Scope", "Later"] } };
  assert.deepEqual(await runCheck(input, mockModel(proposal), quiet), { status: "check_failed" });
});

test("unknown verdict or malformed evidence -> check_failed", async () => {
  const bad = [
    { verdict: "maybe", explanation: "x", evidence: null },
    { verdict: "conflict", explanation: "x", evidence: { quote: "Export results as CSV", headingPath: "Scope > Later" } },
    { verdict: "conflict", explanation: 3, evidence: { quote: "Export results as CSV", headingPath: ["Scope", "Later"] } },
  ];
  for (const proposal of bad) assert.deepEqual(await runCheck(input, mockModel(proposal), quiet), { status: "check_failed" });
});

test("model throws -> check_failed, never unplanned", async () => {
  const model = { propose: async () => { throw new Error("API down"); } };
  assert.deepEqual(await runCheck(input, model, quiet), { status: "check_failed" });
});

// --- Model adapter reading the SDK response (fake client, no network) ---

const valid = { verdict: "conflict", explanation: "Deferred.", evidence: { quote: "Export results as CSV", headingPath: ["Scope", "Later"] } };

test("model: valid parsed_output.proposal flows through to a verified verdict", async () => {
  const client = fakeClient(reply(valid));
  const result = await runCheck(input, createModel({ client, modelName: "test-model" }), quiet);
  assert.equal(result.verdict, "conflict");
  assert.deepEqual(result.evidence, { quote: "Export results as CSV", path: ["Scope", "Later"] });
});

test("model: request uses the configured model, wrapper schema and tagged inputs", async () => {
  const client = fakeClient(reply(valid));
  await createModel({ client, modelName: "test-model" }).propose("PLAN", "DIFF");
  const [params] = client.calls;
  assert.equal(params.model, "test-model");
  assert.equal(params.max_tokens, 16000);
  assert.equal(params.output_config.effort, "medium");
  assert.equal(params.output_config.format.type, "json_schema");
  assert.deepEqual(params.output_config.format.schema.required, ["proposal"]);
  assert.equal(params.output_config.format.schema.properties.proposal.anyOf.length, 2);
  assert.match(params.messages[0].content, /<planning_contract>\nPLAN\n<\/planning_contract>/);
  assert.match(params.messages[0].content, /<proposed_change>\nDIFF\n<\/proposed_change>/);
});

test("model: schema reaches the API with both branches enforced (enum/const kept)", () => {
  const format = proposalFormat();
  assert.equal(format.type, "json_schema");
  const [withEvidence, unplanned] = format.schema.properties.proposal.anyOf;
  assert.deepEqual(withEvidence.properties.verdict.enum, ["aligned", "conflict"]);
  assert.ok(withEvidence.required.includes("evidence"));
  assert.equal(withEvidence.properties.evidence.type, "object");
  assert.equal(unplanned.properties.verdict.const, "unplanned");
  assert.equal(unplanned.properties.evidence.type, "null");
});

for (const stop of ["refusal", "max_tokens"]) {
  test(`model: stop_reason ${stop} -> check_failed`, async () => {
    const result = await runCheck(input, createModel({ client: fakeClient(reply(valid, stop)) }), quiet);
    assert.deepEqual(result, { status: "check_failed" });
  });
}

test("model: missing parsed_output or proposal -> check_failed", async () => {
  for (const message of [{ stop_reason: "end_turn", parsed_output: null }, { stop_reason: "end_turn" }, { stop_reason: "end_turn", parsed_output: {} }]) {
    assert.deepEqual(await runCheck(input, createModel({ client: fakeClient(message) }), quiet), { status: "check_failed" });
  }
});

test("model: impossible branch combinations from the API -> check_failed", async () => {
  const combos = [
    { verdict: "aligned", explanation: "x", evidence: null },
    { verdict: "unplanned", explanation: "x", evidence: { quote: "a", headingPath: [] } },
  ];
  for (const proposal of combos) {
    assert.deepEqual(await runCheck(input, createModel({ client: fakeClient(reply(proposal)) }), quiet), { status: "check_failed" });
  }
});

test("model: SDK error -> check_failed", async () => {
  const client = { messages: { parse: async () => { throw new Error("timeout"); } } };
  assert.deepEqual(await runCheck(input, createModel({ client }), quiet), { status: "check_failed" });
});
