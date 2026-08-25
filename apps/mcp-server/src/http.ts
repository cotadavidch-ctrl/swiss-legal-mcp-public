import { createServer } from "node:http";
import { createLogger, loadHttpEnv } from "@swiss-legal-mcp/shared";
import { createHttpApp } from "./httpApp.js";
import { buildRegistries } from "./registry.js";

async function main(): Promise<void> {
  const settings = loadHttpEnv();
  const logger = createLogger({ level: settings.LOG_LEVEL, name: "swiss-legal-mcp-http" });

  const { providers, legislationProviders, tools } = buildRegistries(settings);
  await Promise.all([providers.checkAllHealth(), legislationProviders.checkAllHealth()]);

  const { app, close } = createHttpApp({
    config: settings,
    logger,
    providers,
    legislationProviders,
    tools,
  });
  const httpServer = createServer(app);

  await new Promise<void>((resolve) => {
    httpServer.listen(settings.MCP_HTTP_PORT, settings.MCP_HTTP_HOST, resolve);
  });
  // Puerto realmente asignado por el SO: coincide con `settings.MCP_HTTP_PORT`
  // salvo que este sea 0 (asignacion automatica), en cuyo caso `address().port`
  // es el unico valor real -- registrar `settings.MCP_HTTP_PORT` en ese caso
  // seria enganoso (siempre "0").
  const address = httpServer.address();
  const actualPort =
    typeof address === "object" && address !== null ? address.port : settings.MCP_HTTP_PORT;

  // Los manejadores de señal se registran ANTES del log de "escuchando": ver
  // la misma nota en stdio.ts -- evita perder la carrera con un SIGTERM que
  // llegue justo despues de que el test de graceful shutdown vea esa línea.
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "cerrando servidor HTTP");
    httpServer.close(() => {
      void close()
        .catch((error: unknown) => {
          logger.error({ error }, "error durante el cierre del servidor MCP");
        })
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  logger.info(
    { port: actualPort, host: settings.MCP_HTTP_HOST },
    "swiss-legal-mcp: servidor HTTP escuchando",
  );
}

main().catch((error: unknown) => {
  console.error("swiss-legal-mcp: fallo al arrancar el servidor HTTP", error);
  process.exitCode = 1;
});
