import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlan, normalize } from "../src/markdown-blocks.js";
import { SAMPLE_PLAN } from "../public/sample.js";
import { FLIPPED_PLAN } from "./fixtures/validation-cases.js";

const texts = (plan) => parsePlan(plan).map((b) => ({ text: normalize(b.text), path: b.path }));
const find = (plan, text) => texts(plan).filter((b) => b.text === text);

test("canonical sample: CSV line sits under Scope > Later", () => {
  assert.deepEqual(find(SAMPLE_PLAN, "Export results as CSV"), [{ text: "Export results as CSV", path: ["Scope", "Later"] }]);
});

test("flipped sample: CSV line sits under Scope > Now", () => {
  assert.deepEqual(find(FLIPPED_PLAN, "Export results as CSV"), [{ text: "Export results as CSV", path: ["Scope", "Now"] }]);
});

test("canonical sample: every block and its path", () => {
  assert.deepEqual(texts(SAMPLE_PLAN), [
    { text: "Pollbox is a tiny survey tool: an owner asks one question, people answer it, and the owner sees the results.", path: ["Scope"] },
    { text: "Create a survey with one multiple-choice question", path: ["Scope", "Now"] },
    { text: "Share a link so people can answer without an account", path: ["Scope", "Now"] },
    { text: "Show results as a bar chart on the owner's page", path: ["Scope", "Now"] },
    { text: "Export results as CSV", path: ["Scope", "Later"] },
    { text: "Email a daily summary to the owner", path: ["Scope", "Later"] },
  ]);
});

test("CRLF and lone CR are normalized", () => {
  assert.deepEqual(texts("# A\r\n## B\r\n- item one\r\n- item two\r# C\r- x"), [
    { text: "item one", path: ["A", "B"] },
    { text: "item two", path: ["A", "B"] },
    { text: "x", path: ["C"] },
  ]);
});

test("wrapped list item continues on indented lines", () => {
  assert.deepEqual(texts("# A\n- first part\n  second part\n\tthird part\n- next"), [
    { text: "first part second part third part", path: ["A"] },
    { text: "next", path: ["A"] },
  ]);
});

test("indented marker starts a new nested item; unindented line starts a paragraph", () => {
  assert.deepEqual(texts("# A\n- parent\n  - child\nnot a continuation"), [
    { text: "parent", path: ["A"] },
    { text: "child", path: ["A"] },
    { text: "not a continuation", path: ["A"] },
  ]);
});

test("ordered list markers are stripped", () => {
  assert.deepEqual(texts("# A\n1. one\n2) two"), [
    { text: "one", path: ["A"] },
    { text: "two", path: ["A"] },
  ]);
});

test("task checkbox is stripped after the list marker", () => {
  assert.deepEqual(texts("# A\n- [ ] open task\n- [x] done task\n* [X] also done"), [
    { text: "open task", path: ["A"] },
    { text: "done task", path: ["A"] },
    { text: "also done", path: ["A"] },
  ]);
});

test("blockquote marker is stripped on each line", () => {
  assert.deepEqual(texts("# A\n> quoted decision\n>continues here"), [{ text: "quoted decision continues here", path: ["A"] }]);
});

test("a # inside fenced code is neither a heading nor citable", () => {
  const plan = "# A\n## Later\n```sh\n# Now\n- not an item\n```\n- after fence\n~~~\n# B\n~~~\n- still later";
  assert.deepEqual(texts(plan), [
    { text: "after fence", path: ["A", "Later"] },
    { text: "still later", path: ["A", "Later"] },
  ]);
});

test("skipped heading levels give a path of only the headings present", () => {
  assert.deepEqual(texts("# A\n### C\n- item\n## B\n- other"), [
    { text: "item", path: ["A", "C"] },
    { text: "other", path: ["A", "B"] },
  ]);
});

test("a level-N heading replaces level N and drops deeper levels", () => {
  assert.deepEqual(texts("# A\n## B\n### C\n## D\n- item\n# E\n- top"), [
    { text: "item", path: ["A", "D"] },
    { text: "top", path: ["E"] },
  ]);
});

test("heading labels: trimmed, closing # run removed, whitespace collapsed", () => {
  assert.deepEqual(texts("#   Scope   ##\n##  Proof   of  Concept ##\n- item\n   ### Indented three\n- deep"), [
    { text: "item", path: ["Scope", "Proof of Concept"] },
    { text: "deep", path: ["Scope", "Proof of Concept", "Indented three"] },
  ]);
});

test("not headings: #hashtag, 7 hashes, 4-space indent", () => {
  const blocks = texts("# A\n#hashtag\n####### seven\n    # four spaces");
  assert.deepEqual(blocks, [{ text: "#hashtag ####### seven # four spaces", path: ["A"] }]);
});

test("inline bold is preserved in block text", () => {
  assert.deepEqual(texts("# A\n- Export **all** results as `CSV`"), [{ text: "Export **all** results as `CSV`", path: ["A"] }]);
});

test("setext underlines are paragraph text, not headings", () => {
  assert.deepEqual(texts("# A\nTitle\n=====\nOther\n---"), [{ text: "Title ===== Other ---", path: ["A"] }]);
});

test("blocks before any heading have an empty path", () => {
  assert.deepEqual(texts("intro line\n\n# A\n- x"), [
    { text: "intro line", path: [] },
    { text: "x", path: ["A"] },
  ]);
});

test("paragraphs end at blank lines, headings and list markers", () => {
  assert.deepEqual(texts("# A\nline one\nline two\n\npara two\n- item\n# B\npara three"), [
    { text: "line one line two", path: ["A"] },
    { text: "para two", path: ["A"] },
    { text: "item", path: ["A"] },
    { text: "para three", path: ["B"] },
  ]);
});

test("normalize collapses ASCII whitespace only", () => {
  assert.equal(normalize("  a \t b\n\nc  "), "a b c");
  assert.equal(normalize(" a "), " a ");
  assert.equal(normalize("Café, **Bold**!"), "Café, **Bold**!");
});
