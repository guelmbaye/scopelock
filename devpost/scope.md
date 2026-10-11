---
doc: scope
status: approved
---

# SCOPELOCK

Checks whether a proposed code change still belongs to the product you decided to build, and shows the planning evidence behind the verdict.

## The Unique Kernel
A change can be valid code and still be the wrong change. SCOPELOCK judges a diff against the **plan**, not against the model's sense of good engineering, and **the model can interpret, but it cannot invent the source**: every piece of evidence must be found word for word in the planning text, **under the section or heading the model claims it sits in**, or it isn't accepted. The same line means different things under "Later" and under "Now," so the quote alone isn't evidence; the quote plus its verified location is.

## Who It's For
A developer working with AI coding agents who has already done the planning (scope, PRD, maybe a spec). Today, drift slips through: the agent adds a feature that was explicitly pushed to "later" because it looks like a natural extension. It compiles, tests pass, the UI looks good. Catching it depends on remembering the decision or rereading the docs.

## The Core Loop
Load the planning contract, paste one proposed change (a git diff), run the check. Get one verdict:
- **Aligned**: clearly supported by a planning decision.
- **Unplanned**: no supporting or conflicting decision found. This is also the fallback whenever a citation can't be verified (quote not found, or not under the claimed section).
- **Conflict**: the change contradicts something explicitly deferred or excluded.

Each verdict comes with a short explanation and the exact quoted decision with its containing section, both verified against the source text. You come back every time an agent hands you a change you're not sure you asked for.

## Inspiration & Identity
Narrow and trustworthy, not clever. It isn't a code reviewer, bug detector, security scanner, project-management tool, or chatbot over the repo. It answers one question: does this change belong?

## Why This Matters to the Learner
"The gap between technical correctness and product alignment" is the thing worth proving. It also mirrors the learner's own goal for this challenge: define the smallest product contract that's precise enough for an agent to build against, and recognize when implementation drifts beyond it.

## What "Working" Looks Like
A single-page local web app: planning text on one side, diff on the other, verdict and verified evidence below.

**The flip test (the finish line):**
1. A coherent diff that would pass normal technical checks adds a feature the plan explicitly marks as **Later**. Result: **Conflict**, quoting that exact "Later" line.
2. Edit only that one decision in the planning text, moving it from Later to Now, and rerun. Result: **Aligned**, quoting the new line.

Same diff, same quoted line, different verdict. The only thing that changed is the line's verified section in the plan.

## The POC Boundary
- One planning contract: editable planning text in the page (the content of scope/PRD).
- One coherent proposed change: a pasted diff representing a single product change.
- One verdict (Aligned / Unplanned / Conflict) + a short explanation + an evidence trail.
- Citation check on quote **and** location: the quote must appear verbatim in the planning text, inside the section/heading the model claims. If either fails, the evidence is rejected and the result falls back to **Unplanned / review plan**.
- A sample plan and sample diff(s) ready to load, so the flip test can be shown in a minute.

## Later
- Mixed diffs: splitting a PR into separate changes, a verdict per change, and rules for combining them.
- GitHub PR integration, CI check, IDE extension, agent hook.
- Reading planning docs and diffs straight from the repo (a CLI or file loading instead of pasting).

## Explicitly Cut
- **Mixed or multi-change diffs:** a stated limitation of the POC. Handling them means building segmentation and aggregation rules, and a weak version of that would undermine the proof.
- **General code review, bug or security detection:** these judge technical quality, which isn't the question SCOPELOCK answers.
- **Project-management features, chat over the repo:** these are a different product.
