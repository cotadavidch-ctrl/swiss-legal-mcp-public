import {
  NotFoundError,
  type DocumentId,
  type HealthStatus,
  type LegalSourceProvider,
  type SearchQuery,
  type SearchResult,
  type SourceAttribution,
} from "@swiss-legal-mcp/core";
import { parseNormalizedDocument, type NormalizedDocument } from "@swiss-legal-mcp/documents";
import { FIXTURE_DOCUMENTS } from "./fixtureDocuments.js";

export class FixtureNotAllowedError extends Error {
  constructor(env: string) {
    super(
      `FixtureProvider solo puede instanciarse con NODE_ENV='test' (recibido: '${env}'). ` +
        "Este proveedor sirve datos sinteticos y nunca debe activarse fuera de pruebas.",
    );
    this.name = "FixtureNotAllowedError";
  }
}

function currentNodeEnv(): string {
  return process.env["NODE_ENV"] ?? "development";
}

/**
 * Proveedor interno de prueba. Sirve documentos sinteticos (ver
 * fixtureDocuments.ts) para validar ProviderRegistry/ToolRegistry sin
 * depender de ninguna fuente juridica real. Nunca se activa fuera de
 * NODE_ENV=test: el guard del constructor es defensa en profundidad ademas
 * de la restriccion declarativa `enabledInEnv` del registro de proveedores.
 */
export class FixtureProvider implements LegalSourceProvider {
  readonly id = "fixture";

  constructor(env: string = currentNodeEnv()) {
    if (env !== "test") {
      throw new FixtureNotAllowedError(env);
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const needle = query.text.toLowerCase();
    return FIXTURE_DOCUMENTS.filter((doc) => doc.title.toLowerCase().includes(needle)).map(
      (doc) => ({
        id: doc.id,
        title: doc.title,
        snippet: doc.fullText?.slice(0, 80),
      }),
    );
  }

  async getDocument(id: DocumentId): Promise<NormalizedDocument> {
    return this.findOrThrow(id);
  }

  async getMetadata(id: DocumentId): Promise<Record<string, unknown>> {
    return this.findOrThrow(id).rawMetadata;
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: true, checkedAt: new Date().toISOString() };
  }

  normalize(raw: unknown): NormalizedDocument {
    return parseNormalizedDocument(raw);
  }

  getSourceAttribution(id: DocumentId): SourceAttribution {
    const doc = this.findOrThrow(id);
    return {
      sourceUrl: doc.provenance.sourceUrl,
      retrievedAt: doc.provenance.retrievedAt,
      officialCharacter: doc.provenance.officialCharacter,
      ...(doc.provenance.aggregatorName !== undefined
        ? { aggregatorName: doc.provenance.aggregatorName }
        : {}),
    };
  }

  private findOrThrow(id: DocumentId): NormalizedDocument {
    const doc = FIXTURE_DOCUMENTS.find((candidate) => candidate.id === id);
    if (!doc) {
      throw new NotFoundError(id);
    }
    return doc;
  }
}
