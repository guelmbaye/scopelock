// Model adapter: asks Claude for a verdict plus ONE proposed piece of evidence.
// The only file that imports @anthropic-ai/sdk. It proposes; it never verifies.
// Spec: spec.md > Components > Model adapter.

import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const DEFAULT_MODEL = "claude-opus-5-5";

// The SDK helper requires a top-level object, so the two branches sit under `proposal`.
export const PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["proposal"],
  properties: {
    proposal: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["verdict", "explanation", "evidence"],
          properties: {
            verdict: { type: "string", enum: ["aligned", "conflict"] },
            explanation: { type: "string" },
            evidence: {
              type: "object",
              additionalProperties: false,
              required: ["quote", "headingPath"],
              properties: {
                quote: { type: "string" },
                headingPath: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["verdict", "explanation", "evidence"],
          properties: {
            verdict: { type: "string", const: "unplanned" },
            explanation: { type: "string" },
            evidence: { type: "null" },
          },
        },
      ],
    },
  },
};

export const SYSTEM_PROMPT = `You are the alignment checker inside SCOPELOCK. You decide whether ONE proposed code change belongs to the product described in a planning contract.

You judge product alignment only. Never judge code quality, correctness, style, tests or security; assume the change works technically.

Verdicts:
- "aligned": a planning decision clearly supports making this change now (for example, it is listed in a section the plan commits to for current work).
- "conflict": the change builds something the plan explicitly defers or excludes (for example, it is listed under a section such as Later, Not now, Out of scope or Cut).
- "unplanned": no planning decision supports or contradicts the change.

Where a decision sits matters as much as what it says: the same line means "build it" under a section for current work and "don't build it yet" under a deferred section. Read the enclosing headings before choosing the verdict.

explanation: one or two plain sentences saying why, naming the decision and its section.

evidence (required for "aligned" and "conflict"; must be null for "unplanned"): cite exactly one planning line or paragraph, the decision that governs your verdict.
- quote: the COMPLETE text of that single line or paragraph, copied character for character from the planning contract. Remove only the leading block syntax: a list marker ("- ", "* ", "+ ", "1. "), a task checkbox ("[ ]", "[x]") and a leading "> ". Keep everything else exactly as written: wording, case, punctuation and inline Markdown such as **bold** or \`code\`. Never shorten, paraphrase, merge two lines, or quote a heading.
- headingPath: the text of every heading that encloses that line, outermost first, without the "#" characters, exactly as written. Include every level, not just the nearest heading.
If no decision governs the change, the verdict is "unplanned" and evidence is null. Never cite a loosely related line to avoid "unplanned".

Example. Planning contract:
# Product
## Must have
- Users can reset their password
## Not now
- Sign in with **Google**
Proposed change: adds a "Continue with Google" OAuth button and callback route.
Output:
{"proposal":{"verdict":"conflict","explanation":"The change adds Google sign-in, which the plan lists under Not now.","evidence":{"quote":"Sign in with **Google**","headingPath":["Product","Not now"]}}}`;

// transform: false keeps `enum`/`const` as real constraints; the SDK's default
// transform would demote them to description text and stop enforcing the branches.
export function proposalFormat() {
  return jsonSchemaOutputFormat(PROPOSAL_SCHEMA, { transform: false });
}

export function userMessage(plan, diff) {
  return `<planning_contract>\n${plan}\n</planning_contract>\n\n<proposed_change>\n${diff}\n</proposed_change>`;
}

const isStringArray = (v) => Array.isArray(v) && v.every((s) => typeof s === "string");

// Defensive branch check: anything outside the two schema branches throws.
function readProposal(message) {
  if (message.stop_reason !== "end_turn") {
    throw new Error(`Model stopped with stop_reason=${message.stop_reason}`);
  }
  const proposal = message.parsed_output?.proposal;
  if (!proposal || typeof proposal !== "object") {
    throw new Error("Model response has no parsed_output.proposal");
  }
  const { verdict, explanation, evidence } = proposal;
  if (typeof explanation !== "string") throw new Error("Proposal explanation is not a string");
  if (verdict === "aligned" || verdict === "conflict") {
    if (!evidence || typeof evidence.quote !== "string" || !isStringArray(evidence.headingPath)) {
      throw new Error(`Proposal ${verdict} lacks valid evidence`);
    }
    return { verdict, explanation, evidence: { quote: evidence.quote, headingPath: evidence.headingPath } };
  }
  if (verdict === "unplanned") {
    if (evidence !== null) throw new Error("Proposal unplanned carries evidence");
    return { verdict, explanation, evidence: null };
  }
  throw new Error(`Proposal has unknown verdict ${verdict}`);
}

// `client` is injectable so tests never reach the network.
export function createModel({ apiKey, modelName = DEFAULT_MODEL, client } = {}) {
  let anthropic = client;
  return {
    modelName,
    async propose(plan, diff) {
      anthropic ??= new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
      const message = await anthropic.messages.parse({
        model: modelName,
        max_tokens: 16000,
        output_config: { effort: "medium", format: proposalFormat() },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage(plan, diff) }],
      });
      return readProposal(message);
    },
  };
}
