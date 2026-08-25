#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "docs", "release", "generated");
fs.mkdirSync(outDir, { recursive: true });

const rootPkg = readJson(path.join(root, "package.json"));
const packageDirs = new Map();
packageDirs.set(`${rootPkg.name}@${rootPkg.version ?? "0.0.0"}:`, {
  pkg: rootPkg,
  dir: root,
  source: "workspace",
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function collectPackageJsons(dir, options = {}, depth = 0) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    const pkgFile = path.join(full, "package.json");
    if (fs.existsSync(pkgFile)) {
      const pkg = readJson(pkgFile);
      if (pkg.name) {
        packageDirs.set(`${pkg.name}@${pkg.version ?? "0.0.0"}:${path.relative(root, full)}`, {
          pkg,
          dir: full,
          source: options.source ?? "node_modules",
        });
      }
    }
    if (options.workspace) {
      if (!["node_modules", "dist", "coverage", ".git"].includes(entry.name)) {
        collectPackageJsons(full, options, depth + 1);
      }
    } else if (depth < 4 || entry.name === "node_modules" || entry.name.startsWith("@")) {
      collectPackageJsons(full, options, depth + 1);
    }
  }
}

collectPackageJsons(root, { workspace: true, source: "workspace" });
collectPackageJsons(path.join(root, "node_modules"), { source: "node_modules" });
collectPackageJsons(path.join(root, "node_modules", ".pnpm"), { source: "node_modules" });

function declaredLicense(pkg) {
  if (typeof pkg.license === "string" && pkg.license.trim()) return pkg.license.trim();
  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
    return pkg.licenses
      .map((license) => (typeof license === "string" ? license : license.type))
      .filter(Boolean)
      .join(" OR ");
  }
  return undefined;
}

function detectLicenseFromFiles(dir) {
  const candidates = fs
    .readdirSync(dir)
    .filter((entry) => /^(licen[cs]e|copying|notice)(?:\.|$)/i.test(entry));
  for (const candidate of candidates) {
    const text = fs.readFileSync(path.join(dir, candidate), "utf8").slice(0, 20_000);
    const detected = detectLicenseText(text);
    if (detected) return { license: detected, file: candidate };
  }
  return undefined;
}

function detectLicenseText(text) {
  if (/Apache License[\s\S]{0,200}Version 2\.0/i.test(text)) return "Apache-2.0";
  if (/MIT License|Permission is hereby granted, free of charge/i.test(text)) return "MIT";
  if (/BSD 3-Clause|Redistribution and use in source and binary forms/i.test(text)) {
    return "BSD-style";
  }
  if (/ISC License|Permission to use, copy, modify, and\/or distribute/i.test(text)) return "ISC";
  if (/Mozilla Public License Version 2\.0/i.test(text)) return "MPL-2.0";
  return undefined;
}

function classify({ pkg, dir, source }) {
  const rel = path.relative(root, dir);
  const internal =
    source === "workspace" ||
    pkg.name === rootPkg.name ||
    (typeof pkg.name === "string" && pkg.name.startsWith("@swiss-legal-mcp/"));
  if (internal) {
    const license = declaredLicense(pkg) ?? rootPkg.license ?? "UNLICENSED";
    const projectRoot = rel === "";
    const linkedWorkspace = source === "node_modules";
    return {
      name: pkg.name,
      version: pkg.version ?? null,
      license,
      path: rel,
      scope: projectRoot ? "project" : linkedWorkspace ? "workspace_link" : "internal",
      classification:
        license === "UNLICENSED" && projectRoot
          ? "requires_project_license_decision"
          : license === "UNLICENSED"
            ? "inherits_project_license_decision"
            : "declared",
      blocksRelease: projectRoot && license === "UNLICENSED",
    };
  }

  const declared = declaredLicense(pkg);
  if (declared) {
    return {
      name: pkg.name,
      version: pkg.version ?? null,
      license: declared,
      path: rel,
      scope: "third_party",
      classification: declared.includes(" OR ") ? "dual" : "declared",
      blocksRelease: false,
    };
  }

  const detected = detectLicenseFromFiles(dir);
  if (detected) {
    return {
      name: pkg.name,
      version: pkg.version ?? null,
      license: detected.license,
      path: rel,
      scope: "third_party",
      classification: "detected_from_license_file",
      evidence: detected.file,
      blocksRelease: false,
    };
  }

  const fixture = /\/test\/fixtures?\//.test(`/${rel}/`) || /\/tests\/fixtures?\//.test(`/${rel}/`);
  return {
    name: pkg.name,
    version: pkg.version ?? null,
    license: "NOASSERTION",
    path: rel,
    scope: fixture ? "dependency_fixture" : "third_party",
    classification: fixture ? "requires_manual_review" : "unknown",
    blocksRelease: !fixture,
  };
}

const packages = Array.from(packageDirs.values())
  .map(classify)
  .sort((a, b) =>
    `${a.scope}:${a.name}@${a.version}:${a.path}`.localeCompare(
      `${b.scope}:${b.name}@${b.version}:${b.path}`,
    ),
  );

const summary = {
  packageCount: packages.length,
  internalPackageCount: packages.filter((item) => item.scope === "internal").length,
  workspaceLinkCount: packages.filter((item) => item.scope === "workspace_link").length,
  thirdPartyPackageCount: packages.filter((item) => item.scope === "third_party").length,
  dependencyFixtureCount: packages.filter((item) => item.scope === "dependency_fixture").length,
  noAssertionCount: packages.filter((item) => item.license === "NOASSERTION").length,
  thirdPartyUnknownBlockers: packages.filter(
    (item) => item.scope === "third_party" && item.blocksRelease,
  ).length,
  manualReviewCount: packages.filter((item) => item.classification === "requires_manual_review")
    .length,
  projectLicenseBlockers: packages.filter((item) => item.scope === "project" && item.blocksRelease)
    .length,
};

const inventory = {
  generatedAt: new Date().toISOString(),
  summary,
  packages,
};

for (const file of ["license-inventory.json", "third-party-licenses.json"]) {
  fs.writeFileSync(path.join(outDir, file), `${JSON.stringify(inventory, null, 2)}\n`);
}

const thirdParty = packages.filter((item) => item.scope === "third_party");
const fixtures = packages.filter((item) => item.scope === "dependency_fixture");
const notices = [
  "# Third Party Notices",
  "",
  "Generated from locally installed package metadata and license files. Review upstream license texts before external distribution.",
  "",
  "| Package | Version | License | Classification | Evidence |",
  "| --- | --- | --- | --- | --- |",
  ...thirdParty.map(
    (item) =>
      `| ${item.name} | ${item.version ?? ""} | ${item.license} | ${item.classification} | ${item.evidence ?? item.path} |`,
  ),
  "",
  "## Excluded Internal Workspace Packages",
  "",
  `Workspace packages are treated as internal packages and are not counted as third-party dependencies. Their current project license is ${rootPkg.license ?? "NOASSERTION"}.`,
  "",
  "## Dependency Fixtures Requiring Manual Review",
  "",
  fixtures.length === 0
    ? "None."
    : fixtures
        .map(
          (item) => `- ${item.name}@${item.version ?? ""}: ${item.path} (${item.classification})`,
        )
        .join("\n"),
  "",
];
fs.writeFileSync(path.join(root, "THIRD_PARTY_NOTICES.md"), notices.join("\n"));

console.log(
  `License inventory written: ${path.relative(root, path.join(outDir, "license-inventory.json"))}`,
);
console.log(
  `THIRD_PARTY_NOTICES.md written (${thirdParty.length} third-party packages, ${summary.thirdPartyUnknownBlockers} third-party blockers, ${summary.manualReviewCount} fixture manual reviews)`,
);
if (summary.thirdPartyUnknownBlockers > 0) {
  console.warn(
    `WARNING: ${summary.thirdPartyUnknownBlockers} third-party packages have unknown license metadata.`,
  );
}
if (summary.manualReviewCount > 0) {
  console.warn(
    `WARNING: ${summary.manualReviewCount} dependency fixture package(s) require manual review.`,
  );
}
