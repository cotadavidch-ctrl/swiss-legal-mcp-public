import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@swiss-legal-mcp/citations": path.join(root, "packages/citations/src/index.ts"),
      "@swiss-legal-mcp/core": path.join(root, "packages/core/src/index.ts"),
      "@swiss-legal-mcp/documents": path.join(root, "packages/documents/src/index.ts"),
      "@swiss-legal-mcp/provider-bsv": path.join(root, "packages/providers/bsv/src/index.ts"),
      "@swiss-legal-mcp/provider-cantonal": path.join(
        root,
        "packages/providers/cantonal/src/index.ts",
      ),
      "@swiss-legal-mcp/provider-entscheidsuche": path.join(
        root,
        "packages/providers/entscheidsuche/src/index.ts",
      ),
      "@swiss-legal-mcp/provider-estv": path.join(root, "packages/providers/estv/src/index.ts"),
      "@swiss-legal-mcp/provider-fedlex": path.join(root, "packages/providers/fedlex/src/index.ts"),
      "@swiss-legal-mcp/provider-fixture": path.join(
        root,
        "packages/providers/fixture/src/index.ts",
      ),
      "@swiss-legal-mcp/provider-seco": path.join(root, "packages/providers/seco/src/index.ts"),
      "@swiss-legal-mcp/provider-shab": path.join(root, "packages/providers/shab/src/index.ts"),
      "@swiss-legal-mcp/search": path.join(root, "packages/search/src/index.ts"),
      "@swiss-legal-mcp/shared": path.join(root, "packages/shared/src/index.ts"),
      "@swiss-legal-mcp/shared-web": path.join(root, "packages/shared-web/src/index.ts"),
      "@swiss-legal-mcp/updater": path.join(root, "packages/updater/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: [
      "apps/*/src/**/*.test.ts",
      "apps/*/tests/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
      "packages/*/tests/**/*.test.ts",
      "packages/providers/*/src/**/*.test.ts",
      "packages/providers/*/tests/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
