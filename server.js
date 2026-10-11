// Express app: serves the page and one JSON route, POST /api/check.
// Spec: spec.md > Components > Server.

import express from "express";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runCheck } from "./src/check.js";
import { createModel } from "./src/model.js";

const isBlank = (v) => typeof v !== "string" || v.trim() === "";

export function createApp({ model, log = console }) {
  const app = express();
  app.use(express.static(fileURLToPath(new URL("./public/", import.meta.url))));
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/check", async (req, res) => {
    const { plan, diff } = req.body ?? {};
    const missing = [isBlank(plan) && "plan", isBlank(diff) && "diff"].filter(Boolean);
    if (missing.length) {
      return res.status(400).json({ status: "invalid_input", missing });
    }
    const result = await runCheck({ plan, diff }, model, log);
    res.status(result.status === "check_failed" ? 502 : 200).json(result);
  });

  // Malformed or oversized JSON bodies.
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
      return res.status(400).json({ status: "invalid_input", missing: [] });
    }
    next(err);
  });

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("Warning: ANTHROPIC_API_KEY is not set. Checks will fail until it is set in .env.");
  }
  const model = createModel({
    apiKey: process.env.ANTHROPIC_API_KEY,
    modelName: process.env.ANTHROPIC_MODEL || undefined,
  });
  const port = Number(process.env.PORT) || 3000;
  createApp({ model }).listen(port, () => {
    console.log(`SCOPELOCK running at http://localhost:${port} (model: ${model.modelName})`);
  });
}
