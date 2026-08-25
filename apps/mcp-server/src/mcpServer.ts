import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { LegalMcpError } from "@swiss-legal-mcp/core";
import { generateCorrelationId, getCorrelationId, type Logger } from "@swiss-legal-mcp/shared";
import type {
  LegislationProviderRegistry,
  ProviderRegistry,
  ToolRegistry,
} from "@swiss-legal-mcp/core";

export interface CreateMcpServerOptions {
  readonly name: string;
  readonly version: string;
  readonly tools: ToolRegistry;
  readonly providers: ProviderRegistry;
  readonly legislationProviders?: LegislationProviderRegistry;
  readonly logger: Logger;
}

/**
 * Construye el McpServer del SDK oficial y registra las herramientas que
 * ToolRegistry considera 'active', MAS las que estan 'blocked' especificamente
 * por politica de cumplimiento (`blockedByPolicy`, p.ej. SHAB/robots.txt) --
 * ver docs/architecture.md#registro-de-herramientas-y-activacion-por-proveedor.
 * La distincion importa: una herramienta bloqueada por una caida transitoria
 * de red (SECO/BSV/ESTV/cantonal cuando el proveedor real esta caido) sigue
 * sin registrarse -- no tiene sentido ofrecerle a un cliente MCP una
 * herramienta que probablemente fallara y podria volver a funcionar sola.
 * Una herramienta bloqueada por politica (nunca va a "recuperarse") si se
 * registra: queda visible en tools/list y, al invocarla, tools/call devuelve
 * un error MCP estructurado (ProviderUnavailableByPolicyError) sin realizar
 * ninguna peticion de red -- nunca se llega al handler real.
 */
export function createMcpServer(options: CreateMcpServerOptions): McpServer {
  const server = new McpServer({ name: options.name, version: options.version });

  for (const toolInfo of options.tools.list()) {
    const registerDespiteBlocked = toolInfo.blockedByPolicy !== undefined;
    if (toolInfo.status !== "active" && !registerDespiteBlocked) {
      options.logger.info(
        { tool: toolInfo.name, status: toolInfo.status, reason: toolInfo.reason },
        "Herramienta no registrada: sin proveedor activo",
      );
      continue;
    }
    if (registerDespiteBlocked) {
      options.logger.info(
        { tool: toolInfo.name, status: toolInfo.status, blockedByPolicy: toolInfo.blockedByPolicy },
        "Herramienta registrada como bloqueada por politica: visible en tools/list, tools/call devolvera error estructurado sin red",
      );
    }

    const definition = options.tools.getDefinition(toolInfo.name);
    const inputSchema =
      definition?.strictInput === true
        ? z.object(definition.inputSchema).strict()
        : definition?.inputSchema;
    server.registerTool(
      toolInfo.name,
      { description: toolInfo.description, inputSchema },
      async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const correlationId = getCorrelationId() ?? generateCorrelationId();
        try {
          const result = await options.tools.call(toolInfo.name, args, {
            providers: options.providers,
            ...(options.legislationProviders !== undefined
              ? { legislationProviders: options.legislationProviders }
              : {}),
            correlationId,
            logger: options.logger,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: toStructuredContent(result),
          };
        } catch (error) {
          return toErrorResult(error, correlationId);
        }
      },
    );
  }

  return server;
}

/** El SDK exige que structuredContent sea un record; envuelve arrays/valores primitivos. */
function toStructuredContent(result: unknown): Record<string, unknown> {
  if (typeof result === "object" && result !== null && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return { result };
}

function toErrorResult(error: unknown, correlationId: string): CallToolResult {
  if (error instanceof LegalMcpError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            code: error.code,
            message: error.message,
            correlationId,
            retryable: error.retryable,
            ...(error.providerId !== undefined ? { provider: error.providerId } : {}),
            ...(error.details !== undefined ? { details: error.details } : {}),
          }),
        },
      ],
    };
  }
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
          correlationId,
        }),
      },
    ],
  };
}
