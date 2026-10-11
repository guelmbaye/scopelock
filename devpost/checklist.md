---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. The verifier enforces the trust rule on its own**
  Becomes usable: `npm test` runs and shows the deterministic kernel deciding evidence: whole-block quote equality under the exact heading path, with the canonical, wrong-path, partial-quote, paraphrase and duplicate-heading cases all producing the expected outcome. No model, no page yet.
  Why now: This is the unique kernel, and it is the one piece with zero external risk, so it can be pinned first and then trusted by everything later. It is the allowed single-layer exception: it independently proves the core trust property and leaves runnable evidence (tests). Bootstrapping (package.json, ES modules, `node --test`, `.gitignore` node_modules) lives here.
  PRD ref: `prd.md > Evidence Verification`, `prd.md > Product Decisions` (full heading path)
  Spec ref: `spec.md > Components > Plan parser`, `spec.md > Components > Verifier`, `spec.md > Validation Set`, `spec.md > File Structure`
  Build: Scaffold `package.json` (type module; scripts start/test/smoke), install `express` and `@anthropic-ai/sdk`, then immediately run two compatibility probes only (no model integration): `@anthropic-ai/sdk/helpers/json-schema` exports the expected helper, and Node accepts `--env-file-if-exists=.env`; stop and report if either differs. Then add `node_modules/` to `.gitignore`, write `public/sample.js` (SAMPLE_PLAN / SAMPLE_DIFF), `src/markdown-blocks.js` (parsePlan, normalize), `src/verify.js` (verifyEvidence), `test/fixtures/validation-cases.js`, `test/markdown-blocks.test.js` (CRLF, wrapped items, checkbox, blockquote, fenced `#`, skipped levels, inline bold, setext, pre-heading), `test/verify.test.js` (cases 1, 2, 4, 5a, 5b, 6).
  Verify (mechanical): `npm test` passes all parser and verifier tests; confirm the sample plan parses `Export results as CSV` under `["Scope","Later"]`.
  Learner check: Run `npm test`, skim `test/verify.test.js`, and judge whether the rejection cases match what you meant by "the model can't invent the source" — especially that a partial quote is rejected.
  Commit: `Add plan parser and evidence verifier with validation cases`

- [x] **2. The flip test runs live in the browser**
  Becomes usable: `npm start`, open localhost:3000, see the preloaded sample, press Check Alignment → **CONFLICT · Stop** with verified evidence `Scope > Later`; move the line to Now, press again → **ALIGNED · Proceed**. `npm run smoke` measures model reliability against the real API.
  Why now: Both remaining risks live here — the SDK's `jsonSchemaOutputFormat` import path / two-branch `anyOf` schema, and your main uncertainty (does the model reproduce the complete block and correct path?). Finding out before building UI states means a prompt problem reshapes the plan cheaply.
  PRD ref: `prd.md > The Core Journey` (steps 1–6), `prd.md > Alignment Check`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Stack` (verify early), `spec.md > Components > Model adapter`, `spec.md > Components > Orchestrator`, `spec.md > Components > Server`, `spec.md > Components > Page shell`, `spec.md > Live Model Smoke Checks`, `spec.md > Look and Feel`
  Build: Confirm the SDK helper import and `--env-file-if-exists`; write `src/model.js` (schema, prompt, stop_reason + parsed_output + branch checks), `src/check.js` (decision table), `server.js` (`createApp({model})`, static, `POST /api/check`, 400/200/502), `public/index.html` + `styles.css` (tokens, layout) + `app.js` with `ready` / `checking` (inputs locked) / `verdict` rendering and verified evidence, `.env.example`, `scripts/smoke-live.js`, `test/check.test.js` (decision table incl. invalid proposals → check_failed).
  Verify (mechanical): `npm test` passes (no network); server starts and serves the page; `npm run smoke` with a real key shows the canonical flip test (cases 1 and 2) passing 3/3, with cases 3 and 6 reported. If the bar is missed: improve the prompt (levers in `spec.md > Decisions and Open Issues`), never loosen the verifier.
  Learner check: Run the flip test yourself in the browser: Conflict, move one line, Aligned. Tell me what you notice about the verdict, explanation and evidence presentation, and anything you'd change before the remaining states go in.
  Commit: `Add model adapter, check endpoint and live flip test page`

- [ ] **3. Every non-happy state is honest**
  Becomes usable: Rejected evidence shows the secondary **Evidence check** note (quote not found / found elsewhere); unrelated diffs show "No relevant planning decision was found"; editing after a verdict shows **Inputs changed — check again**; empty panes show **Not checked** + inline required messages; API failure shows **Check failed** + Try again; Load sample resets; the technical-quality label switches between sample and "not evaluated". README documents setup and limitations.
  Why now: These states only make sense once a real verdict exists to go stale, fail or be rejected; they complete the trust story rather than prove it.
  PRD ref: `prd.md > States and Boundaries`, `prd.md > Evidence Verification`, `prd.md > Technical Quality Labeling`, `prd.md > Sample Preload and Load Sample`, `prd.md > Build-Time Copy Details`
  Spec ref: `spec.md > Components > UI controller`, `spec.md > Components > Server` (`POST /api/check` contract), `spec.md > Important Failure Modes`, `spec.md > Where It Runs and How Someone Tries It`
  Build: Complete the `app.js` state machine (`notChecked`, `outdated`, `failed`, precedence rules, Try again), Evidence check rendering with final copy, Load sample, technical-quality label, `test/api.test.js` (200/400/502 via `createApp` + mock model + fetch on an ephemeral port), `README.md`.
  Verify (mechanical): `npm test` passes including API tests; in the running app, drive each state (wrong-path proposal via a mocked/forced case is covered by tests; empty pane, edit-after-verdict, Load sample, missing API key → Check failed) and confirm the rendered text matches the PRD.
  Learner check: Try to break it: empty a pane, edit after a verdict, paste an unrelated diff, remove the key and check, press Load sample. Confirm each state reads the way the PRD says and never looks like a verdict when it isn't one.
  Commit: `Add outdated, empty, failed and evidence-check states`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 2 (live flip test in the browser)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: 
Route and stops: 
Edit outcome: 
Reflection: 
Activity mode: 

## Revisions

- Model output schema wrapped in a top-level object `{ proposal: anyOf[aligned|conflict + evidence, unplanned + null] }`, read as `parsed_output.proposal` (implementation compatibility; no product change, `check_failed` rules unchanged) — the slice 1 probe showed `jsonSchemaOutputFormat` in `@anthropic-ai/sdk` 0.133.0 throws on a schema whose top level isn't `type: "object"`, so the spec's top-level `anyOf` couldn't be passed. Updated `spec.md` / `spec.html > Model adapter`.
- `jsonSchemaOutputFormat(PROPOSAL_SCHEMA, { transform: false })` (implementation compatibility; no product change) — a slice 2 unit test showed the SDK's default schema transform rewrites `enum: ["aligned","conflict"]` and `const: "unplanned"` into description text, so the API would no longer enforce the verdict↔evidence branches. Disabling the transform sends the approved schema as written. Updated `spec.md` / `spec.html > Model adapter`.

