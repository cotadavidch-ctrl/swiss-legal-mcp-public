import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // nonnegative (no positive): 0 es un valor real y estandar de Node.js
  // ("asigna el SO un puerto libre"), usado por apps/mcp-server/tests/shutdown.test.ts
  // para evitar colisiones con un puerto fijo (ver comentario en ese archivo).
  MCP_HTTP_PORT: z.coerce.number().int().nonnegative().default(3000),
  MCP_HTTP_HOST: z.string().min(1).default("0.0.0.0"),
  MCP_HTTP_BEARER_TOKEN: z.string().min(1).optional(),
  MCP_HTTP_MAX_REQUEST_BYTES: z.coerce.number().int().positive().default(1_048_576),
  MCP_HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  MCP_HTTP_MAX_CONCURRENCY: z.coerce.number().int().positive().default(20),
  MCP_HTTP_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  MCP_HTTP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  // Override opcional del hostname registrado por el logger. Sin definir en
  // produccion (el logger usa os.hostname() por defecto); solo lo fijan los
  // scripts de test/release para no capturar el nombre real de la maquina
  // del desarrollador en artefactos distribuidos.
  LOG_HOSTNAME: z.string().min(1).optional(),
  SWISS_LEGAL_MATTER_STORE_DIR: z.string().min(1).optional(),
});

const httpEnvSchema = baseEnvSchema.superRefine((value, ctx) => {
  if (value.NODE_ENV !== "test" && !value.MCP_HTTP_BEARER_TOKEN) {
    ctx.addIssue({
      code: "custom",
      path: ["MCP_HTTP_BEARER_TOKEN"],
      message:
        "MCP_HTTP_BEARER_TOKEN es obligatorio para el transporte HTTP cuando NODE_ENV no es 'test'.",
    });
  }
});

export type Env = z.infer<typeof baseEnvSchema>;

export class InvalidEnvironmentError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Configuracion de entorno invalida:\n${issues.join("\n")}`);
    this.name = "InvalidEnvironmentError";
    this.issues = issues;
  }
}

function parseEnv(schema: z.ZodType<Env>, source: NodeJS.ProcessEnv): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new InvalidEnvironmentError(issues);
  }
  return result.data;
}

/**
 * Valida process.env para el transporte stdio. No exige credenciales HTTP:
 * stdout queda reservado al protocolo MCP y el canal no acepta peticiones HTTP.
 */
export function loadStdioEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return parseEnv(baseEnvSchema, source);
}

/**
 * Valida process.env para el transporte HTTP. No aplica ningun valor por
 * defecto inventado para credenciales: si falta MCP_HTTP_BEARER_TOKEN fuera
 * de test, el proceso falla aqui en vez de arrancar en un estado inseguro.
 */
export function loadHttpEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return parseEnv(httpEnvSchema, source);
}

/**
 * Alias historico del validador HTTP, conservado para no romper imports
 * publicos existentes. Los entrypoints nuevos deben elegir explicitamente
 * loadHttpEnv() o loadStdioEnv() segun su transporte.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return loadHttpEnv(source);
}
