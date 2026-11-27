import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnv } from "@swiss-legal-mcp/shared";
import { buildRegistries } from "../src/registry.js";

const ROOT = path.resolve(__dirname, "../../..");
const SRC_DIR = path.join(ROOT, "plugins", "src");
const SKILLS_DIR = path.join(SRC_DIR, "skills");
const TOOL_PREFIXES =
  /^(get|search|fetch|verify|analyze|compute|generate|prepare|validate|audit|create|build|resolve|draft|review|extract|find|export|compare|batch)_[a-z_]+$/;
const RULE_SET = /\b(ATSG|ZPO|BGG|VWVG|SCHKG|STPO)_[A-Z_0-9]+\b/g;

function skills() {
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      text: fs.readFileSync(path.join(SKILLS_DIR, entry.name, "SKILL.md"), "utf8"),
    }));
}

function registry() {
  const { tools } = buildRegistries(
    loadEnv({ NODE_ENV: "development", MCP_HTTP_BEARER_TOKEN: "x".repeat(40) }),
  );
  return tools;
}

describe("plugins de litigacion suiza", () => {
  const config = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "plugins.json"), "utf8")) as {
    common: string[];
    plugins: Array<{ name: string; skills: string[] }>;
  };
  const definitions = config.plugins.map((plugin) => ({
    name: plugin.name,
    skills: [...config.common, ...plugin.skills],
  }));

  it("hay cuatro plugins por materia y cada skill que declaran existe", () => {
    expect(definitions.map((d) => d.name)).toEqual([
      "litigacion-civil-suiza",
      "litigacion-administrativa-suiza",
      "litigacion-laboral-suiza",
      "litigacion-penal-suiza",
    ]);
    const available = new Set(skills().map((skill) => skill.name));
    for (const definition of definitions) {
      for (const skill of definition.skills) {
        expect(available.has(skill), `${definition.name} declara ${skill}`).toBe(true);
      }
    }
    // toda skill de la fuente la usa al menos un plugin
    const used = new Set(definitions.flatMap((d) => d.skills));
    for (const skill of available) expect(used.has(skill), `${skill} sin plugin`).toBe(true);
  });

  it("ninguna skill generada remite a skills que su plugin no incluye ni deja marcadores", () => {
    const all = new Set(skills().map((skill) => skill.name));
    for (const definition of definitions) {
      const have = new Set(definition.skills);
      for (const skill of definition.skills) {
        const text = fs.readFileSync(
          path.join(ROOT, "plugins", definition.name, "skills", skill, "SKILL.md"),
          "utf8",
        );
        expect(text, `${definition.name}/${skill}`).not.toContain("{{");
        for (const token of text.matchAll(/`([a-z-]+)`/g)) {
          const word = token[1]!;
          if (all.has(word)) {
            expect(have.has(word), `${definition.name}/${skill} remite a ${word}`).toBe(true);
          }
        }
      }
    }
  });

  it("los plugins generados coinciden con la fuente", () => {
    expect(() =>
      execFileSync("node", ["scripts/build-plugins.mjs", "--check"], { cwd: ROOT, stdio: "pipe" }),
    ).not.toThrow();
  });

  it("cada skill tiene nombre igual a su carpeta y una descripcion", () => {
    for (const skill of skills()) {
      const match = /^---\nname: (.+)\ndescription: "(.+)"\n---/.exec(skill.text);
      expect(match, `frontmatter de ${skill.name}`).not.toBeNull();
      expect(match![1]).toBe(skill.name);
      expect(match![2]!.length).toBeGreaterThan(30);
    }
  });

  it("todas las herramientas y todos los ruleSet que mencionan existen", () => {
    const tools = registry();
    const names = new Set(tools.list().map((tool) => tool.name));
    const ruleSetSchema = tools.getDefinition("compute_legal_deadline")?.inputSchema.ruleSet as
      { options?: string[] } | undefined;
    const ruleSets = new Set<string>(ruleSetSchema?.options ?? []);
    expect(ruleSets.size).toBeGreaterThan(5);
    const parameterNames = new Set(["facts_used", "case_law_plan", "verify_norms"]);
    for (const skill of skills()) {
      for (const token of skill.text.matchAll(/`([a-z_]+)`/g)) {
        const word = token[1]!;
        if (!TOOL_PREFIXES.test(word) || parameterNames.has(word)) continue;
        expect(names.has(word), `${skill.name} menciona la herramienta inexistente ${word}`).toBe(
          true,
        );
      }
      for (const found of skill.text.matchAll(RULE_SET)) {
        expect(ruleSets.has(found[0]), `${skill.name} menciona el ruleSet ${found[0]}`).toBe(true);
      }
    }
  });

  it("ninguna skill copia frases de los plugins de terceros", () => {
    for (const skill of skills()) {
      expect(skill.text).not.toMatch(/jurisprudenciator|derecho virtual|lexiaipro/i);
    }
  });
});
