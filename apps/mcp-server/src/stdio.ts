#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLogger, loadStdioEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "./mcpServer.js";
import { buildRegistries } from "./registry.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

async function main(): Promise<void> {
  const settings = loadStdioEnv();
  const logger = createLogger(
    { level: settings.LOG_LEVEL, name: "swiss-legal-mcp-stdio", hostname: settings.LOG_HOSTNAME },
    { write: (message: string) => process.stderr.write(message) },
  );

  const { providers, legislationProviders, tools } = buildRegistries(settings);
  await Promise.all([providers.checkAllHealth(), legislationProviders.checkAllHealth()]);

  const server: McpServer = createMcpServer({
    name: "swiss-legal-mcp",
    version: "1.0.0",
    tools,
    providers,
    legislationProviders,
    logger,
  });
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "cerrando servidor stdio");
    void server
      .close()
      .catch((error: unknown) => {
        logger.error({ error }, "error durante el cierre del servidor stdio");
      })
      .finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Los manejadores de señal se registran ANTES del log de "conectado":
  // el test de graceful shutdown envía SIGTERM en cuanto ve esa línea en
  // stderr, y si el manejador todavía no estuviera registrado en ese
  // instante, Node terminaría el proceso con el comportamiento por defecto
  // (código de salida 143) en vez de cerrar limpiamente (código 0).
  logger.info("swiss-legal-mcp: servidor stdio conectado");
}

main().catch((error: unknown) => {
  console.error("swiss-legal-mcp: fallo al arrancar el servidor stdio", error);
  process.exitCode = 1;
});
