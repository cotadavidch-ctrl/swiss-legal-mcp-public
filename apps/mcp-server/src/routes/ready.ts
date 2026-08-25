import type { RequestHandler } from "express";
import type { LegislationProviderRegistry, ProviderRegistry } from "@swiss-legal-mcp/core";

/**
 * GET /ready: falla (503) si algun proveedor registrado y no deshabilitado
 * no esta 'healthy'. Con cero proveedores registrados (Fase 1 en produccion,
 * antes de Zefix/etc.) no hay nada que exigir y responde 200. Comprueba
 * tanto `providers` (jurisprudencia) como `legislationProviders` (Fedlex,
 * Fase 3) cuando este ultimo se proporciona.
 */
export function readyHandler(
  providers: ProviderRegistry,
  legislationProviders?: LegislationProviderRegistry,
): RequestHandler {
  return async (_req, res) => {
    const [infos, legislationInfos] = await Promise.all([
      providers.checkAllHealth(),
      legislationProviders?.checkAllHealth() ?? Promise.resolve([]),
    ]);
    const required = [...infos, ...legislationInfos].filter((info) => info.status !== "disabled");
    const allHealthy = required.every((info) => info.status === "healthy");
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? "ready" : "not_ready",
      providers: infos,
      legislationProviders: legislationInfos,
    });
  };
}
