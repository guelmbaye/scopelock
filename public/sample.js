// The canonical flip-test sample. Shared by the page and the tests.

export const SAMPLE_PLAN = `# Scope

Pollbox is a tiny survey tool: an owner asks one question, people answer it, and the owner sees the results.

## Now
- Create a survey with one multiple-choice question
- Share a link so people can answer without an account
- Show results as a bar chart on the owner's page

## Later
- Export results as CSV
- Email a daily summary to the owner
`;

export const SAMPLE_DIFF = `diff --git a/src/results.js b/src/results.js
index 4b1c2d0..9e7f3a1 100644
--- a/src/results.js
+++ b/src/results.js
@@ -1,6 +1,22 @@
 import { getAnswers } from "./store.js";

 export function tallyResults(surveyId) {
   const counts = new Map();
   for (const answer of getAnswers(surveyId)) {
     counts.set(answer.choice, (counts.get(answer.choice) ?? 0) + 1);
   }
   return counts;
 }
+
+function csvCell(value) {
+  const text = String(value);
+  return /[",\\n]/.test(text) ? \`"\${text.replaceAll('"', '""')}"\` : text;
+}
+
+export function resultsToCsv(surveyId) {
+  const rows = [["choice", "votes"]];
+  for (const [choice, votes] of tallyResults(surveyId)) {
+    rows.push([choice, votes]);
+  }
+  return rows.map((row) => row.map(csvCell).join(",")).join("\\n") + "\\n";
+}
diff --git a/src/routes/results.js b/src/routes/results.js
index 1a2b3c4..5d6e7f8 100644
--- a/src/routes/results.js
+++ b/src/routes/results.js
@@ -1,9 +1,17 @@
 import { Router } from "express";
-import { tallyResults } from "../results.js";
+import { tallyResults, resultsToCsv } from "../results.js";

 export const resultsRouter = Router();

 resultsRouter.get("/surveys/:id/results", (req, res) => {
   res.json(Object.fromEntries(tallyResults(req.params.id)));
 });
+
+resultsRouter.get("/surveys/:id/results.csv", (req, res) => {
+  res
+    .type("text/csv")
+    .attachment(\`survey-\${req.params.id}-results.csv\`)
+    .send(resultsToCsv(req.params.id));
+});
diff --git a/public/results.html b/public/results.html
index 7c8d9e0..0a1b2c3 100644
--- a/public/results.html
+++ b/public/results.html
@@ -8,6 +8,9 @@
   <main>
     <h1>Results</h1>
     <div id="chart"></div>
+    <a id="export-csv" class="button" href="results.csv" download>
+      Export results as CSV
+    </a>
   </main>
   <script type="module" src="results-page.js"></script>
 </body>
`;
