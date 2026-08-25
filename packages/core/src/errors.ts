/**
 * Jerarquia de errores tipados de swiss-legal-mcp (ver docs/architecture.md#errores-tipados).
 * Ninguna ruta del servidor debe lanzar/atrapar Error generico para condiciones
 * de negocio: siempre uno de estos tipos, para que el transporte MCP y las
 * pruebas puedan distinguir el motivo exacto de un fallo.
 */

export type LegalMcpErrorCode =
  | "CONFIGURATION_ERROR"
  | "PROVIDER_UNAVAILABLE"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "AMBIGUOUS_CITATION"
  | "VALIDATION_ERROR"
  | "TOOL_DISABLED"
  | "PROVIDER_DISABLED"
  | "CREDENTIALS_MISSING"
  | "UNSUPPORTED_CAPABILITY"
  | "PROVIDER_RESPONSE_ERROR"
  | "SSRF_BLOCKED"
  | "NETWORK_POLICY_ERROR"
  | "REDIRECT_POLICY_ERROR"
  | "UNEXPECTED_CONTENT_TYPE"
  | "RESPONSE_TOO_LARGE"
  | "TIMEOUT"
  | "PARSE_ERROR"
  | "IDENTIFIER_ERROR"
  | "CACHE_ERROR"
  | "INTEGRITY_ERROR"
  | "SECURITY_ERROR"
  | "NON_TEXTUAL_DOCUMENT"
  | "PROVIDER_UNAVAILABLE_BY_POLICY";

export interface LegalMcpErrorOptions {
  readonly safeMessage?: string;
  readonly providerId?: string;
  readonly operation?: string;
  readonly retryable?: boolean;
  readonly statusCode?: number;
  readonly correlationId?: string;
  readonly safeMetadata?: Record<string, unknown>;
  readonly cause?: unknown;
}

export abstract class LegalMcpError extends Error {
  abstract readonly code: LegalMcpErrorCode;
  readonly safeMessage: string;
  readonly providerId?: string;
  readonly operation?: string;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly correlationId?: string;
  readonly safeMetadata?: Record<string, unknown>;
  readonly internalCause?: unknown;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
    options: LegalMcpErrorOptions = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.safeMessage = options.safeMessage ?? message;
    this.providerId = options.providerId;
    this.operation = options.operation;
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode;
    this.correlationId = options.correlationId;
    this.safeMetadata = options.safeMetadata;
    this.internalCause = options.cause;
  }
}

export class ConfigurationError extends LegalMcpError {
  readonly code = "CONFIGURATION_ERROR" as const;

  constructor(
    message: string,
    details?: Record<string, unknown>,
    options: LegalMcpErrorOptions = {},
  ) {
    super(message, details, { ...options, safeMessage: options.safeMessage ?? message });
  }
}

/** La fuente no responde, cambio de estructura, o esta temporalmente caida. */
export class ProviderUnavailableError extends LegalMcpError {
  readonly code = "PROVIDER_UNAVAILABLE" as const;

  constructor(
    override readonly providerId: string,
    message = `El proveedor '${providerId}' no esta disponible.`,
    details?: Record<string, unknown>,
  ) {
    super(message, details, { providerId, retryable: true });
  }
}

export class ProviderDisabledError extends LegalMcpError {
  readonly code = "PROVIDER_DISABLED" as const;

  constructor(
    override readonly providerId: string,
    readonly reason: string,
    message = `El proveedor '${providerId}' esta desactivado: ${reason}`,
  ) {
    super(message, { reason }, { providerId });
  }
}

export class CredentialsMissingError extends LegalMcpError {
  readonly code = "CREDENTIALS_MISSING" as const;

  constructor(
    override readonly providerId: string,
    readonly credentialName: string,
  ) {
    super(
      `Falta la credencial requerida '${credentialName}' para '${providerId}'.`,
      {
        credentialName,
      },
      { providerId },
    );
  }
}

/** El documento/articulo/sentencia solicitado no existe en la fuente. */
export class NotFoundError extends LegalMcpError {
  readonly code = "NOT_FOUND" as const;

  constructor(
    readonly resourceId: string,
    message = `No se encontro el recurso '${resourceId}'.`,
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/** Se alcanzo el limite de frecuencia de la fuente subyacente. */
export class RateLimitedError extends LegalMcpError {
  readonly code = "RATE_LIMITED" as const;

  constructor(
    override readonly providerId: string,
    readonly retryAfterMs?: number,
    message = `Limite de frecuencia alcanzado en '${providerId}'.`,
  ) {
    super(message, retryAfterMs !== undefined ? { retryAfterMs } : undefined, {
      providerId,
      retryable: true,
      ...(retryAfterMs !== undefined ? { safeMetadata: { retryAfterMs } } : {}),
    });
  }
}

export class RateLimitError extends RateLimitedError {}

export class TimeoutError extends LegalMcpError {
  readonly code = "TIMEOUT" as const;

  constructor(
    override readonly operation: string,
    readonly timeoutMs: number,
    message = `Timeout en '${operation}' tras ${timeoutMs} ms.`,
    options: LegalMcpErrorOptions = {},
  ) {
    super(message, { operation, timeoutMs }, { ...options, operation, retryable: true });
  }
}

/** Una cita no pudo resolverse de forma univoca contra la fuente. */
export class AmbiguousCitationError extends LegalMcpError {
  readonly code = "AMBIGUOUS_CITATION" as const;

  constructor(
    readonly citation: string,
    readonly candidateIds: string[],
    message = `La cita '${citation}' es ambigua: ${candidateIds.length} coincidencias.`,
  ) {
    super(message, { candidateIds });
  }
}

/** Entrada de herramienta invalida segun su esquema Zod. */
export class ToolValidationError extends LegalMcpError {
  readonly code = "VALIDATION_ERROR" as const;

  constructor(
    readonly toolName: string,
    readonly issues: string[],
  ) {
    super(`Entrada invalida para '${toolName}': ${issues.join("; ")}`, { issues });
  }
}

/**
 * El proveedor remoto respondio correctamente a nivel de transporte pero
 * senalo un error de aplicacion (p.ej. CallToolResult.isError:true por una
 * entrada invalida segun su propio esquema, o "Unknown tool"). Nunca es
 * transitorio: no debe reintentarse.
 */
export class ProviderResponseError extends LegalMcpError {
  readonly code = "PROVIDER_RESPONSE_ERROR" as const;

  constructor(
    override readonly providerId: string,
    readonly remoteToolName: string,
    readonly remoteMessage: string,
  ) {
    super(
      `El proveedor '${providerId}' rechazo la llamada a '${remoteToolName}': ${remoteMessage}`,
      { remoteToolName, remoteMessage },
    );
  }
}

/** La herramienta existe en el catalogo pero no tiene proveedor activo. */
export class ToolDisabledError extends LegalMcpError {
  readonly code = "TOOL_DISABLED" as const;

  constructor(
    readonly toolName: string,
    readonly reason: string,
  ) {
    super(`La herramienta '${toolName}' esta desactivada: ${reason}`, { reason });
  }
}

/**
 * El proveedor esta permanentemente bloqueado por una decision de
 * cumplimiento (p.ej. robots.txt Disallow), no por una caida transitoria de
 * red. Nunca reintentable (retryable: false) y, por construccion, se lanza
 * ANTES de invocar el handler de la herramienta -- nunca se realiza la
 * peticion de red subyacente (ver ToolRegistry.call() en toolRegistry.ts).
 * Distinto de ProviderUnavailableError (que si es transitorio/reintentable).
 */
export class ProviderUnavailableByPolicyError extends LegalMcpError {
  readonly code = "PROVIDER_UNAVAILABLE_BY_POLICY" as const;

  constructor(
    override readonly providerId: string,
    readonly reason: string,
    message = `El proveedor '${providerId}' no esta disponible por politica de cumplimiento (${reason}).`,
  ) {
    super(message, { reason, networkRequestPerformed: false }, { providerId, retryable: false });
  }
}

export class UnsupportedCapabilityError extends LegalMcpError {
  readonly code = "UNSUPPORTED_CAPABILITY" as const;

  constructor(
    override readonly providerId: string,
    readonly capability: string,
  ) {
    super(
      `El proveedor '${providerId}' no soporta la capacidad '${capability}'.`,
      {
        capability,
      },
      { providerId },
    );
  }
}

/**
 * Una URL candidata a descarga (documento oficial, redireccion, manifestacion)
 * fue rechazada por el cliente HTTP seguro compartido (packages/shared-web):
 * protocolo distinto de https, host privado/loopback, o dominio fuera de la
 * allowlist configurada para ese proveedor. Nunca es transitorio.
 */
export class SsrfBlockedError extends LegalMcpError {
  readonly code = "SSRF_BLOCKED" as const;

  constructor(
    readonly url: string,
    readonly reason: string,
  ) {
    super(
      `URL rechazada por proteccion SSRF ('${reason}'): ${url}`,
      { url, reason },
      {
        safeMessage: `URL rechazada por politica de red: ${reason}`,
      },
    );
  }
}

export class NetworkPolicyError extends LegalMcpError {
  readonly code = "NETWORK_POLICY_ERROR" as const;

  constructor(
    readonly url: string,
    readonly reason: string,
  ) {
    super(
      `URL rechazada por politica de red ('${reason}'): ${url}`,
      { url, reason },
      {
        safeMessage: `URL rechazada por politica de red: ${reason}`,
      },
    );
  }
}

export class RedirectPolicyError extends LegalMcpError {
  readonly code = "REDIRECT_POLICY_ERROR" as const;

  constructor(
    readonly url: string,
    readonly reason: string,
  ) {
    super(
      `Redireccion rechazada ('${reason}'): ${url}`,
      { url, reason },
      {
        safeMessage: `Redireccion rechazada por politica de red: ${reason}`,
      },
    );
  }
}

/** El servidor respondio con un Content-Type distinto del esperado por la operacion. */
export class UnexpectedContentTypeError extends LegalMcpError {
  readonly code = "UNEXPECTED_CONTENT_TYPE" as const;

  constructor(
    readonly url: string,
    readonly expected: string,
    readonly actual: string | null,
  ) {
    super(
      `Content-Type inesperado en '${url}': se esperaba '${expected}', se recibio '${actual ?? "(ausente)"}'.`,
      { url, expected, actual },
    );
  }
}

export class ContentTypeError extends UnexpectedContentTypeError {}

/** La respuesta (por Content-Length o por bytes reales leidos) supera el limite configurado. */
export class ResponseTooLargeError extends LegalMcpError {
  readonly code = "RESPONSE_TOO_LARGE" as const;

  constructor(
    readonly url: string,
    readonly maxBytes: number,
  ) {
    super(`Respuesta de '${url}' rechazada: supera el limite de ${maxBytes} bytes.`, {
      url,
      maxBytes,
    });
  }
}

export class ParseError extends LegalMcpError {
  readonly code = "PARSE_ERROR" as const;

  constructor(
    message: string,
    details?: Record<string, unknown>,
    options: LegalMcpErrorOptions = {},
  ) {
    super(message, details, options);
  }
}

export class ValidationError extends ToolValidationError {}

export class IdentifierError extends LegalMcpError {
  readonly code = "IDENTIFIER_ERROR" as const;

  constructor(
    readonly identifier: string,
    message = `Identificador invalido: '${identifier}'.`,
  ) {
    super(message, { identifier });
  }
}

export class CacheError extends LegalMcpError {
  readonly code = "CACHE_ERROR" as const;

  constructor(
    message: string,
    details?: Record<string, unknown>,
    options: LegalMcpErrorOptions = {},
  ) {
    super(message, details, options);
  }
}

export class IntegrityError extends LegalMcpError {
  readonly code = "INTEGRITY_ERROR" as const;

  constructor(
    message: string,
    details?: Record<string, unknown>,
    options: LegalMcpErrorOptions = {},
  ) {
    super(message, details, options);
  }
}

export class SecurityError extends LegalMcpError {
  readonly code = "SECURITY_ERROR" as const;

  constructor(
    message: string,
    details?: Record<string, unknown>,
    options: LegalMcpErrorOptions = {},
  ) {
    super(message, details, options);
  }
}

/**
 * Un PDF descargado no contiene suficiente texto extraible por pagina para
 * tratarse como un documento textual real (indicio de escaneo/imagen). Fase 4
 * no implementa OCR salvo para documentos escaneados sin alternativa textual;
 * este error se lanza en vez de intentar OCR silenciosamente.
 */
export class NonTextualDocumentError extends LegalMcpError {
  readonly code = "NON_TEXTUAL_DOCUMENT" as const;

  constructor(
    readonly url: string,
    message = `El documento en '${url}' no parece contener texto extraible real (posible documento escaneado); no se aplico OCR.`,
  ) {
    super(message, { url });
  }
}

/**
 * No es un error bloqueante: se adjunta a un resultado que proviene de un
 * agregador no oficial (p.ej. entscheidsuche.ch, LexFind, OpenCaseLaw) para
 * que la respuesta al usuario advierta expresamente su caracter no oficial.
 */
export class UnofficialSourceWarning {
  readonly code = "UNOFFICIAL_SOURCE" as const;

  constructor(
    readonly aggregatorName: string,
    readonly message = `Los resultados provienen de '${aggregatorName}', un agregador no oficial. La cobertura no esta garantizada ni es exhaustiva.`,
  ) {}
}
