import type { RequestHandler } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * POST /mcp: modo stateless del transporte Streamable HTTP oficial.
 *
 * El propio SDK exige un transporte nuevo por peticion en modo stateless
 * (WebStandardStreamableHTTPServerTransport lanza "Stateless transport cannot
 * be reused across requests" si se reutiliza) -- por eso aqui se crea y se
 * conecta un StreamableHTTPServerTransport efimero en cada llamada, en vez de
 * reutilizar una instancia compartida.
 */
export function mcpHandler(mcpServer: McpServer): RequestHandler {
  return async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };
}
