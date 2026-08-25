import { sha256Hex } from "./contentHash.js";

export type PdfSecurityStatus =
  | "safe"
  | "safe_with_warnings"
  | "active_content_detected"
  | "encrypted"
  | "malformed"
  | "too_large"
  | "unsupported"
  | "extraction_failed";

export interface PdfSecurityOptions {
  readonly maxBytes?: number;
  readonly maxObjects?: number;
  readonly maxStreams?: number;
}

export interface PdfSecurityInspection {
  readonly status: PdfSecurityStatus;
  readonly warnings: readonly string[];
  readonly originalHash: string;
  readonly byteLength: number;
  readonly objectCount: number;
  readonly streamCount: number;
}

const DEFAULT_MAX_PDF_BYTES = 50_000_000;
const DEFAULT_MAX_OBJECTS = 50_000;
const DEFAULT_MAX_STREAMS = 10_000;

const ACTIVE_CONTENT_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\/(?:JavaScript|JS)\b/i, "javascript"],
  [/\/OpenAction\b/i, "open_action"],
  [/\/AA\b/i, "additional_actions"],
  [/\/Launch\b/i, "launch_action"],
  [/\/EmbeddedFiles?\b|\/EmbeddedFile\b/i, "embedded_file"],
  [/\/AcroForm\b/i, "acroform"],
  [/\/XFA\b/i, "xfa"],
];

export function inspectPdfSecurity(
  bytes: Uint8Array,
  options: PdfSecurityOptions = {},
): PdfSecurityInspection {
  const byteLength = bytes.byteLength;
  const originalHash = sha256Hex(bytes);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_PDF_BYTES;
  const maxObjects = options.maxObjects ?? DEFAULT_MAX_OBJECTS;
  const maxStreams = options.maxStreams ?? DEFAULT_MAX_STREAMS;

  if (byteLength > maxBytes) {
    return baseResult("too_large", bytes, originalHash, ["pdf_too_large"]);
  }

  const text = Buffer.from(bytes).toString("latin1");
  const objectCount = countMatches(text, /\bobj\b/g);
  const streamCount = countMatches(text, /\bstream\b/g);
  const warnings: string[] = [];

  if (!text.startsWith("%PDF-")) {
    return {
      status: "malformed",
      warnings: ["missing_pdf_magic"],
      originalHash,
      byteLength,
      objectCount,
      streamCount,
    };
  }
  if (!/%%EOF\s*$/s.test(text)) {
    warnings.push("trailing_data_or_missing_eof");
  }
  if (objectCount > maxObjects) warnings.push("too_many_objects");
  if (streamCount > maxStreams) warnings.push("too_many_streams");
  if (/\/Encrypt\b/i.test(text)) {
    return {
      status: "encrypted",
      warnings: [...warnings, "encrypted"],
      originalHash,
      byteLength,
      objectCount,
      streamCount,
    };
  }

  for (const [pattern, warning] of ACTIVE_CONTENT_PATTERNS) {
    if (pattern.test(text)) warnings.push(warning);
  }
  if (/\/URI\b/i.test(text)) warnings.push("external_uri_action");
  if (countMatches(text, /%%EOF/g) > 1) warnings.push("incremental_update");

  if (warnings.some((warning) => ACTIVE_WARNING_SET.has(warning))) {
    return {
      status: "active_content_detected",
      warnings,
      originalHash,
      byteLength,
      objectCount,
      streamCount,
    };
  }
  if (warnings.length > 0) {
    return {
      status: "safe_with_warnings",
      warnings,
      originalHash,
      byteLength,
      objectCount,
      streamCount,
    };
  }
  return { status: "safe", warnings, originalHash, byteLength, objectCount, streamCount };
}

const ACTIVE_WARNING_SET = new Set([
  "javascript",
  "open_action",
  "additional_actions",
  "launch_action",
  "embedded_file",
  "acroform",
  "xfa",
  "external_uri_action",
]);

function baseResult(
  status: PdfSecurityStatus,
  bytes: Uint8Array,
  originalHash: string,
  warnings: readonly string[],
): PdfSecurityInspection {
  const text = Buffer.from(bytes).toString("latin1");
  return {
    status,
    warnings,
    originalHash,
    byteLength: bytes.byteLength,
    objectCount: countMatches(text, /\bobj\b/g),
    streamCount: countMatches(text, /\bstream\b/g),
  };
}

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}
