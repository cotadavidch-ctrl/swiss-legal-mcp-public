import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import { parseCitations, normalizeCitation } from "../packages/citations/src/index.js";
import {
  LegislationProviderRegistry,
  ProviderRegistry,
  ToolRegistry,
} from "../packages/core/src/index.js";
import { registerSearchAcrossSourcesTools } from "../apps/mcp-server/src/tools/searchAcrossSourcesTools.js";
import { registerProceduralStrategyTools } from "../apps/mcp-server/src/tools/proceduralStrategyTools.js";

const root = process.cwd();
const outDir = path.join(root, "docs", "release", "generated");
fs.mkdirSync(outDir, { recursive: true });

function measure(name: string, iterations: number, fn: () => void | Promise<void>) {
  return Promise.resolve().then(async () => {
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) await fn();
    const durationMs = performance.now() - start;
    return { name, iterations, durationMs, opsPerSecond: (iterations / durationMs) * 1000 };
  });
}

const sample =
  "Vgl. Art. 8 BV, Art.  OR 41, RS 220, BGE 129 I 232, ATF 145 III 409 und Urteil 4A_123/2020.";

const results = [
  await measure("citation parser", 10_000, () => {
    parseCitations(sample);
  }),
  await measure("citation normalizer", 10_000, () => {
    for (const citation of parseCitations(sample)) normalizeCitation(citation);
  }),
  await measure("ProviderRegistry lookup", 50_000, () => {
    const providers = new ProviderRegistry();
    providers.get("missing");
  }),
  await measure("MCP tool serialization", 5_000, () => {
    const tools = new ToolRegistry(new ProviderRegistry(), new LegislationProviderRegistry());
    registerSearchAcrossSourcesTools(tools);
    registerProceduralStrategyTools(tools);
    JSON.stringify(tools.list());
  }),
];

const baseline = { generatedAt: new Date().toISOString(), results };
const out = path.join(outDir, "benchmark-baseline.json");
fs.writeFileSync(out, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`Benchmark baseline written: ${path.relative(root, out)}`);
for (const result of results) {
  console.log(
    `${result.name}: ${result.opsPerSecond.toFixed(0)} ops/s (${result.iterations} iterations)`,
  );
}
