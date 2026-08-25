export type RdfFormat = "rdfxml" | "turtle" | "ntriples" | "jsonld";

export type RdfSecurityStatus =
  | "safe"
  | "safe_with_warnings"
  | "blocked_external_reference"
  | "malformed"
  | "too_large"
  | "too_complex";

export interface RdfSecurityOptions {
  readonly maxBytes?: number;
  readonly maxTriples?: number;
  readonly maxDepth?: number;
  readonly maxBlankNodes?: number;
  readonly maxLiteralBytes?: number;
}

export interface RdfSecurityInspection {
  readonly status: RdfSecurityStatus;
  readonly warnings: readonly string[];
  readonly byteLength: number;
  readonly estimatedTripleCount: number;
  readonly blankNodeCount: number;
  readonly maxDepth: number;
}

const DEFAULT_MAX_RDF_BYTES = 10_000_000;
const DEFAULT_MAX_TRIPLES = 200_000;
const DEFAULT_MAX_DEPTH = 64;
const DEFAULT_MAX_BLANK_NODES = 50_000;
const DEFAULT_MAX_LITERAL_BYTES = 1_000_000;

export function inspectRdfSecurity(
  input: string,
  format: RdfFormat,
  options: RdfSecurityOptions = {},
): RdfSecurityInspection {
  const byteLength = Buffer.byteLength(input, "utf8");
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_RDF_BYTES;
  if (byteLength > maxBytes) {
    return result("too_large", ["rdf_too_large"], byteLength, 0, 0, 0);
  }

  const warnings: string[] = [];
  if (format === "rdfxml") inspectRdfXml(input, warnings);
  if (format === "jsonld") inspectJsonLd(input, warnings, options);
  if (format === "turtle" || format === "ntriples") inspectTurtleLike(input, warnings);

  const estimatedTripleCount = estimateTriples(input, format);
  const blankNodeCount = countMatches(input, /(?:^|[\s;,(])_:[A-Za-z][A-Za-z0-9_-]*/g);
  const maxDepth = estimateDepth(input, format);
  const maxTriples = options.maxTriples ?? DEFAULT_MAX_TRIPLES;
  const maxBlankNodes = options.maxBlankNodes ?? DEFAULT_MAX_BLANK_NODES;
  const allowedDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  if (
    estimatedTripleCount > maxTriples ||
    blankNodeCount > maxBlankNodes ||
    maxDepth > allowedDepth
  ) {
    warnings.push("rdf_complexity_limit_exceeded");
    return result(
      "too_complex",
      warnings,
      byteLength,
      estimatedTripleCount,
      blankNodeCount,
      maxDepth,
    );
  }

  if (hasOversizedLiteral(input, options.maxLiteralBytes ?? DEFAULT_MAX_LITERAL_BYTES)) {
    warnings.push("literal_too_large");
    return result(
      "too_complex",
      warnings,
      byteLength,
      estimatedTripleCount,
      blankNodeCount,
      maxDepth,
    );
  }

  if (warnings.some((warning) => warning.startsWith("external_") || warning === "xml_doctype")) {
    return result(
      "blocked_external_reference",
      warnings,
      byteLength,
      estimatedTripleCount,
      blankNodeCount,
      maxDepth,
    );
  }
  return result(
    warnings.length > 0 ? "safe_with_warnings" : "safe",
    warnings,
    byteLength,
    estimatedTripleCount,
    blankNodeCount,
    maxDepth,
  );
}

function inspectRdfXml(input: string, warnings: string[]): void {
  if (/<!DOCTYPE/i.test(input)) warnings.push("xml_doctype");
  if (/<!ENTITY/i.test(input)) warnings.push("external_entity");
  if (/\b(?:xsi:schemaLocation|rdf:about)=["']https?:\/\//i.test(input)) {
    warnings.push("external_url_reference");
  }
  if (/<owl:imports\b/i.test(input)) warnings.push("external_import");
}

function inspectJsonLd(input: string, warnings: string[], options: RdfSecurityOptions): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    warnings.push("jsonld_malformed");
    return;
  }
  const maxDepth = maxJsonDepth(parsed);
  if (maxDepth > (options.maxDepth ?? DEFAULT_MAX_DEPTH)) warnings.push("jsonld_depth_exceeded");
  if (hasRemoteJsonLdContext(parsed)) warnings.push("external_jsonld_context");
}

function inspectTurtleLike(input: string, warnings: string[]): void {
  if (/@prefix\s+\w*:\s*<https?:\/\/[^>]+>/i.test(input)) warnings.push("external_prefix_iri");
  if (/<https?:\/\/[^>]+>/i.test(input)) warnings.push("external_url_reference");
  if (/\bowl:imports\b/i.test(input)) warnings.push("external_import");
}

function estimateTriples(input: string, format: RdfFormat): number {
  if (format === "ntriples")
    return input.split("\n").filter((line) => line.trim().endsWith(".")).length;
  if (format === "rdfxml")
    return countMatches(input, /<rdf:Description\b|<[^/!?][^>]+\srdf:about=/g);
  if (format === "jsonld") return countMatches(input, /"@id"\s*:/g);
  return countMatches(input, /\s\.\s*(?:\n|$)/g);
}

function estimateDepth(input: string, format: RdfFormat): number {
  if (format === "jsonld") {
    try {
      return maxJsonDepth(JSON.parse(input));
    } catch {
      return 0;
    }
  }
  let depth = 0;
  let maxDepth = 0;
  for (const char of input) {
    if (char === "<" || char === "[" || char === "(") maxDepth = Math.max(maxDepth, ++depth);
    if ((char === ">" || char === "]" || char === ")") && depth > 0) depth -= 1;
  }
  return maxDepth;
}

function maxJsonDepth(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return 1 + Math.max(0, ...children.map((child) => maxJsonDepth(child)));
}

function hasRemoteJsonLdContext(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => hasRemoteJsonLdContext(entry));
  const record = value as Record<string, unknown>;
  const context = record["@context"];
  if (typeof context === "string" && /^https?:\/\//i.test(context)) return true;
  return Object.values(record).some((entry) => hasRemoteJsonLdContext(entry));
}

function hasOversizedLiteral(input: string, maxLiteralBytes: number): boolean {
  const stringLiterals = input.match(/"([^"\\]|\\.)*"/gs) ?? [];
  return stringLiterals.some((literal) => Buffer.byteLength(literal, "utf8") > maxLiteralBytes);
}

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

function result(
  status: RdfSecurityStatus,
  warnings: readonly string[],
  byteLength: number,
  estimatedTripleCount: number,
  blankNodeCount: number,
  maxDepth: number,
): RdfSecurityInspection {
  return { status, warnings, byteLength, estimatedTripleCount, blankNodeCount, maxDepth };
}
