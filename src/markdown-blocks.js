// Splits planning text into citable blocks, each with its governing heading path.
// Pure and deterministic: no AI, no dependencies. Rules: spec.md > Components > Plan parser.

const HEADING = /^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/;
const LIST_MARKER = /^\s*([-*+]|\d+[.)])\s+/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const INDENTED = /^( {2,}|\t)/;
const CHECKBOX = /^\[[ xX]\](?:\s+|$)/;
const BLOCKQUOTE = /^\s*> ?/;

// Collapse runs of ASCII whitespace to one space and trim. Nothing else changes.
export function normalize(s) {
  return s.replace(/[ \t\n\r]+/g, " ").replace(/^ | $/g, "");
}

function headingLabel(rest) {
  let label = rest.trim();
  if (/^#+$/.test(label)) return "";
  label = label.replace(/[ \t]+#+$/, "");
  return normalize(label);
}

function blockText(lines, isListItem) {
  const stripped = lines.map((line) => line.replace(BLOCKQUOTE, ""));
  if (isListItem) {
    stripped[0] = stripped[0].replace(LIST_MARKER, "").replace(CHECKBOX, "");
  }
  return stripped.join("\n");
}

export function parsePlan(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const headings = []; // headings[level - 1] = label
  let current = null; // { lines, isListItem }
  let fence = null; // { char, length }

  const path = () => headings.filter((h) => h !== undefined);
  const flush = () => {
    if (current) {
      blocks.push({ text: blockText(current.lines, current.isListItem), path: current.path });
      current = null;
    }
  };
  const start = (line, isListItem) => {
    flush();
    current = { lines: [line], isListItem, path: path() };
  };

  for (const line of lines) {
    if (fence) {
      const close = line.match(FENCE);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length && /^\s*$/.test(line.slice(line.indexOf(close[1]) + close[1].length))) {
        fence = null;
      }
      continue;
    }

    const open = line.match(FENCE);
    if (open) {
      flush();
      fence = { char: open[1][0], length: open[1].length };
      continue;
    }

    if (line.trim() === "") {
      flush();
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      flush();
      const level = heading[1].length;
      headings.length = level - 1;
      headings[level - 1] = headingLabel(heading[2]);
      continue;
    }

    if (LIST_MARKER.test(line)) {
      start(line, true);
      continue;
    }

    if (current && (!current.isListItem || INDENTED.test(line))) {
      current.lines.push(line);
      continue;
    }

    start(line, false);
  }
  flush();
  return blocks;
}
