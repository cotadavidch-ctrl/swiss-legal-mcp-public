import { z } from "zod";
import type { Logger } from "@swiss-legal-mcp/shared";
import {
  ProviderUnavailableByPolicyError,
  ToolDisabledError,
  ToolValidationError,
} from "./errors.js";
import type { ProviderRegistry } from "./provider.js";
import type { LegislationProviderRegistry } from "./legislationProvider.js";

export interface ToolContext {
  readonly providers: ProviderRegistry;
  /** Ausente en Fases sin proveedores de legislacion registrados (Fase 1-2). */
  readonly legislationProviders?: LegislationProviderRegistry;
  readonly correlationId: string;
  readonly logger: Logger;
}

export type ToolInputShape = Record<string, z.ZodTypeAny>;

export interface ToolDefinition<Shape extends ToolInputShape = ToolInputShape> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Shape;
  /** Si se activa, rechaza claves top-level no declaradas en el esquema. */
  readonly strictInput?: boolean;
  /** IDs de packages/providers/* que deben estar 'healthy' (todos) para activar esta herramienta. */
  readonly requiredProviderIds: readonly string[];
  /**
   * IDs alternativos de los que basta con que UNO este 'healthy' (util para
   * herramientas canton-aware con un proveedor por canton, ver
   * apps/mcp-server/src/tools/cantonalTools.ts). Se combina con
   * `requiredProviderIds` (AND) -- omitir o dejar vacio si no aplica.
   */
  readonly requireAnyProviderIds?: readonly string[];
  readonly handler: (
    input: { [K in keyof Shape]: z.infer<Shape[K]> },
    context: ToolContext,
  ) => Promise<unknown>;
}

export type ToolActivationStatus = "active" | "pending" | "blocked";

export interface ToolInfo {
  readonly name: string;
  readonly description: string;
  readonly status: ToolActivationStatus;
  readonly requiredProviderIds: readonly string[];
  readonly requireAnyProviderIds?: readonly string[];
  readonly reason?: string;
  /**
   * Presente cuando `status` es 'blocked' Y el proveedor requerido esta
   * bloqueado por politica de cumplimiento (ver HealthStatus.unavailableByPolicy),
   * no por una caida transitoria. apps/mcp-server usa esta senal -- no el
   * nombre de la herramienta -- para decidir si sigue exponiendola en
   * tools/list pese a estar bloqueada (ver docs/architecture.md).
   */
  readonly blockedByPolicy?: { readonly providerId: string; readonly reason: string };
}

/**
 * Registro central de herramientas MCP. Una herramienta solo se activa
 * cuando todos sus proveedores requeridos estan registrados y 'healthy'
 * (ver docs/architecture.md#registro-de-herramientas-y-activacion-por-proveedor).
 * Nunca simula un resultado para una herramienta sin proveedor: call()
 * lanza ToolDisabledError en ese caso, o ProviderUnavailableByPolicyError
 * cuando el bloqueo es por politica de cumplimiento (ver blockedByPolicy).
 */
export class ToolRegistry {
  private readonly definitions = new Map<string, ToolDefinition>();

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly legislationProviders?: LegislationProviderRegistry,
  ) {}

  register<Shape extends ToolInputShape>(definition: ToolDefinition<Shape>): void {
    if (this.definitions.has(definition.name)) {
      throw new Error(`La herramienta '${definition.name}' ya esta registrada.`);
    }
    this.definitions.set(definition.name, definition as unknown as ToolDefinition);
  }

  private activation(definition: ToolDefinition): {
    status: ToolActivationStatus;
    reason?: string;
    blockedByPolicy?: { providerId: string; reason: string };
  } {
    for (const providerId of definition.requiredProviderIds) {
      const providerInfo =
        this.providers.info(providerId) ?? this.legislationProviders?.info(providerId);
      if (!providerInfo) {
        return {
          status: "pending",
          reason: `El proveedor '${providerId}' no esta registrado todavia.`,
        };
      }
      if (providerInfo.status !== "healthy") {
        return {
          status: "blocked",
          reason: `El proveedor '${providerId}' no esta disponible (estado: ${providerInfo.status}).`,
          ...(providerInfo.unavailableByPolicy
            ? { blockedByPolicy: { providerId, reason: providerInfo.unavailableByPolicy.reason } }
            : {}),
        };
      }
    }

    const anyIds = definition.requireAnyProviderIds ?? [];
    if (anyIds.length > 0) {
      const infos = anyIds.map(
        (id) => this.providers.info(id) ?? this.legislationProviders?.info(id),
      );
      const anyHealthy = infos.some((info) => info?.status === "healthy");
      if (!anyHealthy) {
        const anyRegistered = infos.some((info) => info !== undefined);
        return anyRegistered
          ? {
              status: "blocked",
              reason: `Ninguno de los proveedores alternativos (${anyIds.join(", ")}) esta disponible.`,
            }
          : {
              status: "pending",
              reason: `Ninguno de los proveedores alternativos (${anyIds.join(", ")}) esta registrado todavia.`,
            };
      }
    }

    return { status: "active" };
  }

  /** Acceso a la definicion cruda, para que el adaptador de transporte (apps/mcp-server) pueda leer inputSchema. */
  getDefinition(name: string): ToolDefinition | undefined {
    return this.definitions.get(name);
  }

  list(): ToolInfo[] {
    return [...this.definitions.values()].map((definition) => {
      const { status, reason, blockedByPolicy } = this.activation(definition);
      return {
        name: definition.name,
        description: definition.description,
        status,
        requiredProviderIds: definition.requiredProviderIds,
        ...(definition.requireAnyProviderIds
          ? { requireAnyProviderIds: definition.requireAnyProviderIds }
          : {}),
        ...(reason !== undefined ? { reason } : {}),
        ...(blockedByPolicy !== undefined ? { blockedByPolicy } : {}),
      };
    });
  }

  isActive(name: string): boolean {
    const definition = this.definitions.get(name);
    if (!definition) return false;
    return this.activation(definition).status === "active";
  }

  async call(name: string, rawInput: unknown, context: ToolContext): Promise<unknown> {
    const definition = this.definitions.get(name);
    if (!definition) {
      throw new ToolDisabledError(name, "la herramienta no existe en el catalogo.");
    }
    const { status, reason, blockedByPolicy } = this.activation(definition);
    if (status !== "active") {
      if (blockedByPolicy) {
        throw new ProviderUnavailableByPolicyError(
          blockedByPolicy.providerId,
          blockedByPolicy.reason,
        );
      }
      throw new ToolDisabledError(name, reason ?? "sin proveedor disponible.");
    }

    const inputObjectSchema = definition.strictInput
      ? z.object(definition.inputSchema).strict()
      : z.object(definition.inputSchema);
    const parsed = inputObjectSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
      throw new ToolValidationError(name, issues);
    }

    return definition.handler(parsed.data, context);
  }
}
