---
doc: prd
status: approved
---

# SCOPELOCK — Product Requirements

A single-page local tool for developers working with AI coding agents. It checks whether one proposed code change belongs to the product they planned, and shows the verified planning evidence behind the verdict.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. **Open the page.** The workspace is already loaded with the canonical sample. The planning pane holds the flip-test plan, where "Export results as CSV" sits under a Later section. The diff pane holds the matching CSV-export diff, labeled *Sample scenario · known-working change*. The result area reads **Ready to check**.
2. **Press Check Alignment.** SCOPELOCK asks the model for a verdict and one proposed piece of evidence (quote plus claimed heading path), then verifies that evidence against the planning text itself.
3. **See Conflict.** The result shows **CONFLICT · Stop**, a short explanation, and one verified evidence item: the quote "Export results as CSV" and its location `Scope > Later`.
4. **Edit one decision.** In the planning pane, the user moves that one line from Later to Now. The diff stays the same. The Conflict result is immediately replaced with **Inputs changed — check again**. Nothing reruns automatically.
5. **Press Check Alignment again.** The result shows **ALIGNED · Proceed**, with the same quote now verified under its new location (for example `Scope > Now`).
6. **Success.** Same diff, same quoted line, different verdict. The only change is where that line sits in the plan.

At any point the user can replace either pane with their own content and run the check again, or press **Load sample** to restore the canonical sample.

## Screens and Layout
One screen, one workspace:

- **Header / workspace heading**: product name, plus a small secondary **Load sample** control near the heading, above the input panes. It is clearly secondary and never placed next to the primary action.
- **Two input panes side by side**:
  - Left: **Planning contract**, editable planning text (scope/PRD content).
  - Right: **Proposed change**, an editable diff, with the sample/technical-quality label above it (see `Technical Quality Labeling`).
- **Primary action**: **Check Alignment**, the main call to action.
- **Result area** below the panes, showing the product-alignment result, explanation, and evidence or evidence check.

## Look and Feel
- A calm, precise developer instrument, closer to a code-review or inspection tool than to an AI product. Mood: quiet confidence, traceability, control.
- Neutral light background, strong typography, generous spacing, very little decoration.
- System sans-serif for the interface. **Monospace for planning text, diffs, quotes, and locations**, so the code and the evidence read as the primary material.
- Takes the discipline of GitHub or Linear without copying either.
- **Verdict colors are accents, not full-screen fills.** The verdict word, the action, and the evidence carry the meaning:
  - Aligned: restrained green, calm and affirmative, with **Proceed**.
  - Unplanned: amber / warm neutral, meaning a human decision is needed, with **Review plan**.
  - Conflict: restrained red, high salience but not alarmist, with **Stop**.
- The hierarchy alone should make the contrast obvious: the change is technically fine (or not evaluated), yet product alignment can fail.
- **Avoid:** neon gradients, glowing AI effects, chat bubbles, too many cards, large illustrations, "AI magic" styling.

## Features and Behavior

### Sample Preload and Load Sample
Source: `scope.md > The POC Boundary` (sample plan and diff ready to load).

- On first open, both panes are pre-filled with the canonical flip-test sample and the result area reads **Ready to check**. No check runs automatically.
- The sample plan has both a Now and a Later section, so the flip-test edit is a simple move of one line.
- **Load sample** restores the canonical plan and diff and returns the result area to **Ready to check**.
  - [ ] On first load, both panes show the sample and the result area reads "Ready to check", with no verdict.
  - [ ] After editing either pane, pressing Load sample restores both panes exactly and resets the result area.
  - [ ] Load sample is visually secondary to Check Alignment and sits near the workspace heading.

### Alignment Check
Source: `scope.md > The Core Loop`.

- Pressing **Check Alignment** with both inputs present produces exactly one verdict: **Aligned**, **Unplanned**, or **Conflict**.
  - **Aligned · Proceed**: clearly supported by a verified planning decision.
  - **Conflict · Stop**: contradicts a verified decision that was explicitly deferred or excluded.
  - **Unplanned · Review plan**: no verified supporting or conflicting decision. Also the fallback whenever proposed evidence fails verification.
- Each verdict comes with a short explanation (a sentence or two).
- The result is labeled as **Product alignment**, never as a code-quality judgment.
  - [ ] The canonical sample, unedited, produces **Conflict · Stop**.
  - [ ] After moving "Export results as CSV" from Later to Now, the same diff produces **Aligned · Proceed**.
  - [ ] Every result shows one verdict word, its action, and a short explanation.
  - [ ] Editing either pane (leaving it non-empty) after a verdict immediately replaces the verdict with "Inputs changed — check again", and no check runs until Check Alignment is pressed.
  - [ ] While a check is running, both panes, Load sample, and Check Alignment are disabled.

### Evidence Verification
Source: `scope.md > The Unique Kernel`, `scope.md > The POC Boundary`.

- The model proposes **exactly one** piece of evidence: an exact quote and the **full heading path** it claims governs that quote (for example `Scope > POC Boundary > Later`).
- SCOPELOCK accepts the evidence only if **both** hold:
  1. the quote appears word for word in the planning text, and
  2. that occurrence sits under the claimed full heading path.
- If either check fails, the evidence is rejected and the verdict becomes **Unplanned · Review plan**, whatever the model suggested.
- Valid Aligned or Conflict results show one evidence item:
  ```
  Evidence
  "Export results as CSV"
  Location: Scope > Later
  ```
- Rejected evidence shows as a compact, visually secondary **Evidence check** note under the Unplanned verdict. It is provenance, not an error screen:
  ```
  Evidence check
  Proposed quote: "Export results as CSV"
  Claimed location: Scope > Later
  Rejected: quote found under Scope > Now, not under the claimed location.
  ```
- Unplanned with no evidence proposed shows:
  ```
  Evidence
  No relevant planning decision was found for this change.
  ```
- Both Unplanned cases share the same primary verdict (**UNPLANNED · Review plan**). Only the secondary evidence detail differs. There is no fourth verdict.
  - [ ] Aligned and Conflict results always show one quote and its full heading path, and the quote can be found verbatim under that path in the planning pane.
  - [ ] If the claimed path is wrong (quote exists elsewhere), the result is Unplanned with an Evidence check note naming the claimed location and why it was rejected.
  - [ ] If the quote doesn't appear verbatim anywhere, the result is Unplanned with an Evidence check note saying the quote wasn't found.
  - [ ] An unrelated diff yields Unplanned with "No relevant planning decision was found for this change."

### Technical Quality Labeling
Source: `scope.md > Explicitly Cut` (no code review), `scope.md > Why This Matters to the Learner`.

- SCOPELOCK never shows a fake "tests pass", build status, or CI-style indicator.
- While the diff pane holds the unedited sample diff, a small secondary label above it reads *Sample scenario · known-working change*, with the note: *Technical quality is intentionally assumed for this demo; SCOPELOCK only checks whether the change belongs to the plan.*
- Once the diff differs from the sample, the label reads *Technical quality: not evaluated*.
  - [ ] The sample label shows only while the diff pane matches the sample diff.
  - [ ] After editing or replacing the diff, the label changes to "Technical quality: not evaluated".
  - [ ] No test, build, or CI status appears anywhere on the page.

## States and Boundaries
- **First use / after Load sample**: both panes hold the sample, and the result area reads **Ready to check**.
- **Checking**: shown while the check runs. Both input panes, Load sample, and Check Alignment are disabled until it completes, so the result always matches the snapshot that was checked. *(Exact indicator wording can be set during the build.)*
- **Outdated result**: after a completed check, any edit to either pane that leaves both non-empty replaces the verdict with a neutral non-verdict state: *Inputs changed — check again. The previous result no longer applies to the current inputs.* There is no auto-rerun and no visible result history.
- **Empty input**: if the planning text or the diff is empty when Check Alignment is pressed, no model call is made and no verdict is produced. An inline message appears on the missing pane (**Planning contract required** / **Proposed change required**), and the result area reads **Not checked**.
- **Input emptied after a verdict**: the previous verdict is cleared and the result area reads **Not checked**, with the inline required message. This takes precedence over the outdated state.
- **Check failed** (model/API failure or a response missing the structured fields needed to evaluate it): shows a non-verdict state: *Check failed. SCOPELOCK couldn't complete the analysis. Your inputs are unchanged.* plus **Try again**. No verdict and no verified evidence are shown, and the inputs stay intact. This is never shown as Unplanned.
- **Persistence**: none. Reloading the page restores the sample. *(Assumption.)*

## Product Decisions
- **Sample preloaded, check not auto-run.** Empty editors would force setup before the value is visible, and requiring the click keeps the flip test hands-on.
- **Load sample is secondary and sits near the workspace heading.** Its job is recovery after edits. Check Alignment stays the one primary action.
- **A section is the full heading path, not the nearest heading.** This avoids ambiguity when the same heading name (such as "Later") appears in several places. Parsing rules are left to `4-spec`.
- **Exactly one evidence item per verdict.** The POC proves one change against one decision, not evidence ranking or aggregation.
- **Rejected evidence stays visible but secondary.** It makes the trust boundary visible: the model suggests, SCOPELOCK verifies.
- **No fabricated technical-quality signal.** The sample is framed as a known-working change, and anything else is labeled "not evaluated", so the tool never claims the code works.
- **System failure is not a verdict.** Unplanned is a legitimate product judgment. A failed check is its own non-verdict state.
- **A verdict goes outdated as soon as its inputs change.** Leaving Conflict · Stop visible after the decision moved would make a stale result look authoritative, which works against traceability. The user reruns on purpose.
- **Inputs are locked while a check runs.** The result in flight always belongs to the snapshot that was checked.
- **One Unplanned state.** "No evidence" and "rejected evidence" differ only in the secondary detail, because the user action (review the plan) is the same.

## What We're Building
- One page with a planning pane, a diff pane, Check Alignment, and a result area.
- The canonical flip-test sample, preloaded and restorable with Load sample.
- A model-backed check that returns one verdict, a short explanation, and one proposed evidence item.
- Verification of quote plus full heading path against the planning text, with fallback to Unplanned and a visible Evidence check note.
- Technical-quality labeling (sample vs. not evaluated).
- Checking (inputs locked), outdated-result, empty-input, and check-failed states.
- The visual direction in `Look and Feel`.

## Deferred From the POC
- **Mixed / multi-change diffs** (segmentation, per-change verdicts, aggregation rules). A weak version would undermine the proof. (`scope.md > Later`, `scope.md > Explicitly Cut`)
- **Multiple evidence items, ranking, or selection.** One verdict, one evidence trail is enough to prove the kernel.
- **Loading plans/diffs from the repo, CLI, or files.** Pasting is enough for the proof. (`scope.md > Later`)
- **GitHub PR integration, CI check, IDE extension, agent hook.** (`scope.md > Later`)
- **Saving inputs or history between sessions.** Nothing in the flip test needs it.

## Possible Later Enhancements
- A gallery of more sample scenarios (Unplanned, rejected-evidence) to show every verdict in one click.
- Highlighting the verified quote inside the planning pane.

## Non-Goals
- **Code review, bug or security detection.** These judge technical quality, which isn't SCOPELOCK's question.
- **Any technical-quality indicator** (tests, build, CI). SCOPELOCK doesn't evaluate them and won't imply it does.
- **Project-management features or chat over the repo.** A different product.
- **A conversational interface.** It answers one question per check, not a dialogue.

## Build-Time Copy Details
- **Rejection reason wording.** The behavior is fixed (see `Evidence Verification`). The Evidence check note must distinguish **"quote not found"** (not verbatim anywhere in the planning text) from **"quote found outside the claimed heading path"** (and name where it was found). Only the exact copy is left for the build.

## Open Questions
None. Nothing blocks `4-spec`.
