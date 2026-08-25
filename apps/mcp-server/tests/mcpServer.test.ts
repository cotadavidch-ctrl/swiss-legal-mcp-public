import { describe, expect, it } from "vitest";
import { z } from "zod";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { NotFoundError, ProviderRegistry, ToolRegistry } from "@swiss-legal-mcp/core";
import { createLogger } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";

const logger = createLogger({ level: "silent" });

async function connectedClient(tools: ToolRegistry, providers: ProviderRegistry) {
  const server = createMcpServer({
    name: "swiss-legal-mcp-test",
    version: "0.0.0",
    tools,
    providers,
    logger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, server };
}

describe("createMcpServer (via InMemoryTransport, equivalente a la conexion stdio)", () => {
  it("no registra herramientas cuyo proveedor no esta activo, solo las activas", async () => {
    const providers = new ProviderRegistry();
    const tools = new ToolRegistry(providers);
    tools.register({
      name: "pending_tool",
      description: "sin proveedor",
      inputSchema: {},
      requiredProviderIds: ["nunca-registrado"],
      handler: async () => ({ ok: true }),
    });
    tools.register({
      name: "always_active_tool",
      description: "no depende de ningun proveedor",
      inputSchema: {},
      requiredProviderIds: [],
      handler: async () => ({ ok: true }),
    });

    const { client } = await connectedClient(tools, providers);
    const { tools: listed } = await client.listTools();
    expect(listed.map((t) => t.name)).toEqual(["always_active_tool"]);
  });

  it("registra y ejecuta una herramienta activa de extremo a extremo", async () => {
    const providers = new ProviderRegistry();
    const tools = new ToolRegistry(providers);
    tools.register({
      name: "echo_tool",
      description: "repite la entrada",
      inputSchema: { message: z.string().min(1) },
      requiredProviderIds: [],
      handler: async (input) => ({ echoed: input.message }),
    });

    const { client } = await connectedClient(tools, providers);
    const { tools: listed } = await client.listTools();
    expect(listed.map((t) => t.name)).toEqual(["echo_tool"]);

    const result = await client.callTool({ name: "echo_tool", arguments: { message: "hola" } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ echoed: "hola" });
  });

  it("convierte un LegalMcpError lanzado por el handler en isError:true con su codigo", async () => {
    const providers = new ProviderRegistry();
    const tools = new ToolRegistry(providers);
    tools.register({
      name: "failing_tool",
      description: "siempre falla con NotFoundError",
      inputSchema: {},
      requiredProviderIds: [],
      handler: async () => {
        throw new NotFoundError("bge-inexistente");
      },
    });

    const { client } = await connectedClient(tools, providers);
    const result = await client.callTool({ name: "failing_tool", arguments: {} });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "{}";
    const parsed = JSON.parse(text) as { code: string; message: string; correlationId: string };
    expect(parsed.code).toBe("NOT_FOUND");
    expect(parsed.correlationId).toBeTruthy();
  });
});
