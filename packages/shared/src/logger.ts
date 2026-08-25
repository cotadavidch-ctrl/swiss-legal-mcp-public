import os from "node:os";
import { pino, type DestinationStream, type Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie",
  "*.authorization",
  "*.cookie",
  "*.token",
  "*.bearerToken",
  "*.password",
  "*.apiKey",
  "*.api_key",
  "*.secret",
  "*.credentials",
  '*["MCP_HTTP_BEARER_TOKEN"]',
];

export interface CreateLoggerOptions {
  level: string;
  name?: string;
  /**
   * Override para el campo `hostname` que pino añade por defecto (via
   * os.hostname()) a cada linea de log. Solo lo usan procesos de
   * test/release que capturan stderr en artefactos distribuidos, para no
   * incluir el nombre real de la maquina del desarrollador. Si se omite,
   * el comportamiento de produccion no cambia.
   */
  hostname?: string;
}

/**
 * Logger estructurado (JSON) con redaccion de campos sensibles habituales.
 * Nunca registra tokens, credenciales ni contenido completo de documentos
 * con licencia restrictiva (eso lo decide la capa de proveedores, no el logger).
 */
export function createLogger(
  options: CreateLoggerOptions,
  destination?: DestinationStream,
): Logger {
  const config = {
    name: options.name ?? "swiss-legal-mcp",
    level: options.level,
    base: {
      pid: process.pid,
      hostname: options.hostname ?? os.hostname(),
    },
    redact: {
      paths: REDACT_PATHS,
      censor: "[redacted]",
    },
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  return destination ? pino(config, destination) : pino(config);
}
