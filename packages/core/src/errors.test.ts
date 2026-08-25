import { describe, expect, it } from "vitest";
import {
  AmbiguousCitationError,
  CacheError,
  ConfigurationError,
  ContentTypeError,
  CredentialsMissingError,
  IdentifierError,
  IntegrityError,
  LegalMcpError,
  NetworkPolicyError,
  NonTextualDocumentError,
  NotFoundError,
  ParseError,
  ProviderDisabledError,
  ProviderUnavailableError,
  RateLimitError,
  RateLimitedError,
  RedirectPolicyError,
  ResponseTooLargeError,
  SecurityError,
  SsrfBlockedError,
  TimeoutError,
  ToolDisabledError,
  ToolValidationError,
  UnsupportedCapabilityError,
  ValidationError,
  UnexpectedContentTypeError,
  UnofficialSourceWarning,
} from "./errors.js";

describe("jerarquia de errores tipados", () => {
  it("cada error de negocio extiende LegalMcpError y expone su codigo", () => {
    expect(new ProviderUnavailableError("fedlex")).toBeInstanceOf(LegalMcpError);
    expect(new ProviderUnavailableError("fedlex").code).toBe("PROVIDER_UNAVAILABLE");

    expect(new NotFoundError("bge-1").code).toBe("NOT_FOUND");
    expect(new RateLimitedError("zefix", 5000).code).toBe("RATE_LIMITED");
    expect(new AmbiguousCitationError("OR Art. 41", ["a", "b"]).code).toBe("AMBIGUOUS_CITATION");
    expect(new ToolValidationError("search_cases", ["query: requerido"]).code).toBe(
      "VALIDATION_ERROR",
    );
    expect(new ToolDisabledError("search_cases", "sin proveedor").code).toBe("TOOL_DISABLED");
  });

  it("RateLimitedError conserva retryAfterMs en details", () => {
    const error = new RateLimitedError("zefix", 5000);
    expect(error.details).toEqual({ retryAfterMs: 5000 });
  });

  it("AmbiguousCitationError conserva los candidatos", () => {
    const error = new AmbiguousCitationError("OR Art. 41", ["doc-1", "doc-2"]);
    expect(error.candidateIds).toEqual(["doc-1", "doc-2"]);
    expect(error.message).toContain("2 coincidencias");
  });

  it("UnofficialSourceWarning no es un Error (no bloqueante) pero identifica el agregador", () => {
    const warning = new UnofficialSourceWarning("entscheidsuche.ch");
    expect(warning).not.toBeInstanceOf(Error);
    expect(warning.code).toBe("UNOFFICIAL_SOURCE");
    expect(warning.message).toContain("entscheidsuche.ch");
  });

  it("errores de seguridad/descarga de Fase 4 extienden LegalMcpError y exponen su codigo", () => {
    const ssrf = new SsrfBlockedError("http://localhost/x", "localhost o IP privada");
    expect(ssrf).toBeInstanceOf(LegalMcpError);
    expect(ssrf.code).toBe("SSRF_BLOCKED");
    expect(ssrf.details).toEqual({ url: "http://localhost/x", reason: "localhost o IP privada" });

    const contentType = new UnexpectedContentTypeError(
      "https://example.org/a.pdf",
      "application/pdf",
      "text/html",
    );
    expect(contentType.code).toBe("UNEXPECTED_CONTENT_TYPE");
    expect(contentType.message).toContain("text/html");

    const tooLarge = new ResponseTooLargeError("https://example.org/a.pdf", 1000);
    expect(tooLarge.code).toBe("RESPONSE_TOO_LARGE");
    expect(tooLarge.details).toEqual({ url: "https://example.org/a.pdf", maxBytes: 1000 });

    const nonTextual = new NonTextualDocumentError("https://example.org/scan.pdf");
    expect(nonTextual.code).toBe("NON_TEXTUAL_DOCUMENT");
    expect(nonTextual.message).toContain("escaneado");
  });

  it("expone la taxonomia de Fase 7 sin romper codigos existentes", () => {
    const errors = [
      new ConfigurationError("config invalida"),
      new ProviderDisabledError("fedlex", "mantenimiento"),
      new CredentialsMissingError("mcp-http", "MCP_HTTP_BEARER_TOKEN"),
      new UnsupportedCapabilityError("fedlex", "transitionalProvisions"),
      new RateLimitError("fedlex"),
      new TimeoutError("fetch", 1000),
      new NetworkPolicyError("https://example.test:22/x", "puerto no permitido"),
      new RedirectPolicyError("https://evil.test/x", "dominio no permitido"),
      new ContentTypeError("https://example.test/x", "application/json", "text/html"),
      new ParseError("parseo fallido"),
      new ValidationError("tool", ["campo requerido"]),
      new IdentifierError("bad id"),
      new CacheError("cache fallida"),
      new IntegrityError("hash inesperado"),
      new SecurityError("contenido activo"),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(LegalMcpError);
      expect(error.safeMessage).toBeTruthy();
      expect(error.retryable).toEqual(expect.any(Boolean));
    }

    expect(new RateLimitError("fedlex").code).toBe("RATE_LIMITED");
    expect(new ContentTypeError("u", "a", "b").code).toBe("UNEXPECTED_CONTENT_TYPE");
    expect(new NetworkPolicyError("u", "r").code).toBe("NETWORK_POLICY_ERROR");
  });
});
