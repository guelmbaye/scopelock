# SCOPELOCK

Checks whether one proposed code change still belongs to the product you planned, and shows the planning evidence behind the verdict.

A change can be valid code and still be the wrong change. SCOPELOCK judges a diff against the **plan**, not against code quality. Claude reads the plan and the diff and proposes a verdict with one piece of evidence: a quote and the heading path it claims the quote sits under. Plain deterministic code, with no AI in it, then checks that evidence against the planning text. The quote must equal one complete planning line or paragraph, and that line must sit under exactly the claimed headings. If either check fails, the verdict becomes **Unplanned**, whatever the model said. The model interprets; it can't invent the source.

| Verdict | Action | Meaning |
|---|---|---|
| **Aligned** | Proceed | A verified planning decision supports the change. |
| **Conflict** | Stop | The change builds something the plan explicitly defers or excludes. |
| **Unplanned** | Review plan | No verified decision supports or contradicts it. This is also the fallback when proposed evidence fails verification. |

## The flip test

1. Open the page. The sample plan lists `Export results as CSV` under `## Later`, and the sample diff adds CSV export.
2. **Check Alignment** returns **CONFLICT · Stop**, with evidence `"Export results as CSV"` at `Scope > Later`.
3. Move that one line under `## Now`. The old result is replaced with *Inputs changed — check again*.
4. **Check Alignment** returns **ALIGNED · Proceed**, with the same quote now at `Scope > Now`.

The diff and the quoted line are the same both times. Only the line's verified location in the plan changed.

## Run it

Requirements: Node 22.9 or later, and an Anthropic API key.

```bash
npm install
cp .env.example .env   # then set ANTHROPIC_API_KEY in .env
npm start              # http://localhost:3000
```

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required. Used only by the server; the page never sees it. |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Model used for the proposal. |
| `PORT` | `3000` | Local port. |

Without a key, the server starts with a warning and every check shows **Check failed**.

## Tests

```bash
npm test         # parser, verifier, orchestrator, model adapter, API and UI state machine; never calls the API
npm run smoke    # live model checks against the real API (about 12 calls); never part of npm test
```

The smoke script runs four validation cases three times each:
- the canonical sample (case 1);
- the same plan with the CSV line moved to Now (case 2);
- an unrelated README fix (case 3);
- the same line under two different `Later` headings (case 6).

Last recorded result, on `claude-opus-5-5`: **12/12 live smoke checks, including 6/6 canonical flip-test runs.** This is a bounded result for these sample cases, not a general reliability claim.

## How it is built

```
server.js                Express: serves public/, POST /api/check
src/model.js             The only file that talks to Claude: prompt, structured-output schema, response validation
src/check.js             Orchestrator: model proposal → verifier → final result
src/markdown-blocks.js   Splits the plan into citable blocks with their heading paths
src/verify.js            Whole-block quote equality under the exact claimed heading path
public/                  The page: index.html, styles.css, app.js (DOM), state.js (result state machine), sample.js
test/                    node:test suites and the shared validation cases
scripts/smoke-live.js    Live model smoke checks
```

## Limitations (deliberate, for this proof of concept)

- One coherent change per check. Mixed or multi-change diffs aren't split or judged separately.
- One evidence item per verdict.
- Plans are pasted in, not loaded from a repo. Only ATX `#` headings define sections.
- The quote must match a whole planning line or paragraph, apart from whitespace. Paraphrases and partial quotes are rejected by design, and the result falls back to Unplanned.
- The verifier checks *where* a quote sits, not whether that location fits the verdict. That interpretation is the model's job.
- No code review, bug or security detection, and no technical-quality signal. The sample diff is labeled as a known-working change; any other diff shows *Technical quality: not evaluated*.
- Nothing is saved. Reloading the page restores the sample.
