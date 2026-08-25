import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  LegislationProviderRegistry,
  ProviderRegistry,
  ToolRegistry,
} from "@swiss-legal-mcp/core";
import type { Env, Logger } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "./mcpServer.js";
import { bearerAuth } from "./middleware/auth.js";
import { concurrencyLimit } from "./middleware/concurrency.js";
import { correlationIdMiddleware } from "./middleware/correlationId.js";
import { buildRateLimit } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { requestTimeout } from "./middleware/timeout.js";
import { healthHandler } from "./routes/health.js";
import { mcpHandler } from "./routes/mcp.js";
import { readyHandler } from "./routes/ready.js";

export interface HttpAppDeps {
  readonly config: Env;
  readonly logger: Logger;
  readonly providers: ProviderRegistry;
  readonly legislationProviders?: LegislationProviderRegistry;
  readonly tools: ToolRegistry;
  readonly serverName?: string;
  readonly serverVersion?: string;
}

export interface HttpApp {
  readonly app: Express;
  readonly mcpServer: McpServer;
  readonly close: () => Promise<void>;
}

/**
 * Construye la app Express completa (middlewares, /health, /ready, /mcp) y el
 * McpServer con las herramientas activas registradas. Factory pura para
 * poder inyectar registries de prueba desde los tests de integracion sin
 * depender de variables de entorno globales. No es async: cada POST /mcp
 * crea su propio transporte (ver routes/mcp.ts), asi que no hay nada que
 * esperar durante la construccion de la app.
 */
export function createHttpApp(deps: HttpAppDeps): HttpApp {
  const mcpServer = createMcpServer({
    name: deps.serverName ?? "swiss-legal-mcp",
    version: deps.serverVersion ?? "1.0.0",
    tools: deps.tools,
    providers: deps.providers,
    ...(deps.legislationProviders !== undefined
      ? { legislationProviders: deps.legislationProviders }
      : {}),
    logger: deps.logger,
  });
  const settings = deps.config;
  const app = express();
  app.disable("x-powered-by");
  app.use(correlationIdMiddleware());
  app.use(requestLogger(deps.logger));
  app.use(concurrencyLimit(settings.MCP_HTTP_MAX_CONCURRENCY));
  app.use(requestTimeout(settings.MCP_HTTP_REQUEST_TIMEOUT_MS));
  app.use(buildRateLimit(settings));

  app.get("/health", healthHandler());
  app.get("/ready", readyHandler(deps.providers, deps.legislationProviders));

  app.post(
    "/mcp",
    express.json({ limit: settings.MCP_HTTP_MAX_REQUEST_BYTES }),
    bearerAuth(settings),
    mcpHandler(mcpServer),
  );

  app.use((req: Request, res: Response) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: `Ruta no encontrada: ${req.path}` } });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const isPayloadTooLarge =
      typeof err === "object" &&
      err !== null &&
      "type" in err &&
      (err as { type?: string }).type === "entity.too.large";
    const status = isPayloadTooLarge ? 413 : 400;
    res.status(status).json({
      error: {
        code: isPayloadTooLarge ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST",
        message: err instanceof Error ? err.message : "Peticion invalida.",
      },
    });
  });

  return {
    app,
    mcpServer,
    close: async () => {
      await mcpServer.close();
    },
  };
}
