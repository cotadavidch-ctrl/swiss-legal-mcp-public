#!/usr/bin/env node
/**
 * Genera los plugins de litigacion suiza desde una unica fuente (plugins/src).
 * Cada plugin recibe sus skills copiadas, un plugin.json y un README. Los plugins no pueden
 * compartir skills entre si, asi que se duplican aqui en vez de mantenerse a mano.
 *
 *   node scripts/build-plugins.mjs           # genera plugins/<nombre>/
 *   node scripts/build-plugins.mjs --check   # falla si lo generado no coincide con la fuente
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "plugins", "src");
const check = process.argv.includes("--check");
const out = check
  ? fs.mkdtempSync(path.join(os.tmpdir(), "plugins-check-"))
  : path.join(root, "plugins");

const config = JSON.parse(fs.readFileSync(path.join(src, "plugins.json"), "utf8"));
// Cada plugin lleva las skills comunes mas las propias de su materia.
const definitions = config.plugins.map((plugin) => ({
  ...plugin,
  own: plugin.skills,
  skills: [...config.common, ...plugin.skills],
}));
const principles = fs.readFileSync(path.join(src, "README-principios.md"), "utf8");

const STATES = `## Estados de hechos en cada herramienta
Cada herramienta usa sus propios nombres. Al llamarlas, traduce asi:

| Estado de la skill | \`analyze_procedural_strategy\` | \`generate_rechtsbegehren\` | consejo (\`prepare_legal_council\`) |
|---|---|---|---|
| accepted | \`accepted\` | \`confirmed\` | \`accepted\` |
| alleged | \`alleged\` | \`user_asserted\` | \`alleged\` |
| disputed | \`disputed\` | \`disputed\` | \`disputed\` |
| unknown | \`uncertain\` | \`uncertain\` | \`unknown\` |
`;

function description(skillDir) {
  const text = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
  const match = /^---\nname: .+\ndescription: "(.+)"\n---/.exec(text);
  if (!match) throw new Error(`frontmatter invalido en ${skillDir}`);
  return JSON.parse(`"${match[1]}"`);
}

const names = [];
for (const plugin of definitions) {
  names.push(plugin.name);
  const dir = path.join(out, plugin.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, ".claude-plugin"), { recursive: true });
  fs.mkdirSync(path.join(dir, "skills"), { recursive: true });
  const lines = [];
  for (const skill of plugin.skills) {
    const from = path.join(src, "skills", skill);
    if (!fs.existsSync(from)) throw new Error(`${plugin.name}: falta la skill ${skill}`);
    fs.cpSync(from, path.join(dir, "skills", skill), { recursive: true });
    lines.push(`- \`${skill}\`: ${description(from)}`);
  }
  const triage = path.join(dir, "skills", "triage-gerichtspost", "SKILL.md");
  if (fs.existsSync(triage)) {
    const routes = plugin.own.map((skill) => `\`${skill}\``).join(", ");
    fs.writeFileSync(
      triage,
      fs.readFileSync(triage, "utf8").replaceAll("{{RUTAS}}", routes || "ninguna en este plugin"),
    );
  }
  fs.writeFileSync(
    path.join(dir, ".claude-plugin", "plugin.json"),
    JSON.stringify(
      {
        name: plugin.name,
        version: fs.readFileSync(path.join(src, "VERSION"), "utf8").trim(),
        author: { name: "swiss-legal-mcp" },
        description: plugin.description,
        keywords: ["swiss-legal-mcp", "legal", "suiza", "litigacion"],
      },
      null,
      2,
    ) + "\n",
  );
  const readme = principles
    .replaceAll("{{displayName}}", plugin.displayName)
    .replaceAll("{{description}}", plugin.description);
  fs.writeFileSync(
    path.join(dir, "README.md"),
    `${readme.trimEnd()}\n\n${STATES}\n## Skills\n${lines.join("\n")}\n`,
  );
}

if (check) {
  const differences = [];
  const walk = (base, rel = "") =>
    fs
      .readdirSync(path.join(base, rel), { withFileTypes: true })
      .flatMap((e) =>
        e.isDirectory() ? walk(base, path.join(rel, e.name)) : [path.join(rel, e.name)],
      );
  for (const name of names) {
    const generated = path.join(out, name);
    const committed = path.join(root, "plugins", name);
    const a = new Set(walk(generated));
    const b = fs.existsSync(committed) ? new Set(walk(committed)) : new Set();
    for (const file of new Set([...a, ...b])) {
      if (!a.has(file) || !b.has(file)) differences.push(`${name}/${file}`);
      else if (
        !fs
          .readFileSync(path.join(generated, file))
          .equals(fs.readFileSync(path.join(committed, file)))
      )
        differences.push(`${name}/${file}`);
    }
  }
  fs.rmSync(out, { recursive: true, force: true });
  if (differences.length > 0) {
    console.error(
      `plugins desactualizados (ejecuta node scripts/build-plugins.mjs):\n${differences.join("\n")}`,
    );
    process.exit(1);
  }
  console.log("plugins al dia con la fuente");
} else {
  console.log(`plugins generados: ${names.join(", ")}`);
}
