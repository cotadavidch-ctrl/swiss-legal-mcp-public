// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // eslint.config.js se excluye del linting type-aware: bajo el "default
    // project" inferido para archivos sueltos, `import.meta.dirname` resuelve
    // a un tipo error y no aporta nada revisar el propio fichero de config.
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "*.js",
      "*.mjs",
      "_day1-*.mjs",
      "_day1-validation-output/**",
      "debug_*.js",
      "debug_*.mjs",
      "debug_sections.js",
      "exhaustive_variant_check*.js",
      "fetch_and_examine.js",
      "final_answer.ts",
      "json_debug.js",
      "run-all-test-cases.js",
      "simple_*.js",
      "test_*.js",
      "test_*.mjs",
      "test_*.ts",
      "eslint.config.js",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js", "*.ts", "apps/mcp-server/scripts/*.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": "error",
      // Muchos metodos de LegalSourceProvider son async por contrato de
      // interfaz (ver packages/core/src/provider.ts) aunque una
      // implementacion concreta (FixtureProvider, mocks de test) no necesite
      // esperar nada internamente. Exigir 'await' ahi produciria ruido, no
      // deteccion de errores reales.
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      // Los tests pasan referencias sueltas a metodos mockeados (p.ej.
      // `expect(res.status).toHaveBeenCalledWith(...)`) constantemente; no
      // hay riesgo real de perder el `this` porque son vi.fn() en objetos
      // literales, no instancias reales de la clase tipada.
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    files: [
      "apps/mcp-server/src/stdio.ts",
      "apps/mcp-server/src/http.ts",
      "apps/admin-cli/src/index.ts",
      "apps/mcp-server/scripts/procedural-strategy-eval.ts",
      "apps/mcp-server/scripts/procedural-strategy-review.ts",
    ],
    rules: {
      // Unico punto legitimo para reportar un fallo de arranque antes de
      // que exista un logger estructurado, o para la salida de un CLI.
      "no-console": "off",
    },
  },
  eslintConfigPrettier,
);
