import { isIP } from "node:net";

export interface DomainAllowlistResolution {
  readonly isAllowed: boolean;
  readonly domain?: string;
  readonly reason?: string;
}

export interface DomainAllowlistResolverOptions {
  readonly allowedPorts?: readonly number[];
  readonly allowHttp?: boolean;
}

export interface DomainAllowlistResolveOptions {
  readonly resolvedAddresses?: readonly string[];
}

const DEFAULT_ALLOWED_PORTS = [443] as const;

const PRIVATE_IPV4_RANGES: ReadonlyArray<(octets: number[]) => boolean> = [
  (o) => o[0] === 0,
  (o) => o[0] === 10,
  (o) => o[0] === 100 && (o[1] ?? 0) >= 64 && (o[1] ?? 0) <= 127,
  (o) => o[0] === 127,
  (o) => o[0] === 169 && o[1] === 254,
  (o) => o[0] === 172 && (o[1] ?? 0) >= 16 && (o[1] ?? 0) <= 31,
  (o) => o[0] === 192 && o[1] === 0 && o[2] === 0,
  (o) => o[0] === 192 && o[1] === 168,
  (o) => o[0] === 198 && (o[1] === 18 || o[1] === 19),
  (o) => (o[0] ?? -1) >= 224,
];

function isPrivateOrLoopbackIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  return PRIVATE_IPV4_RANGES.some((check) => check(octets));
}

function isPrivateOrLoopbackIpv6(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isPrivateOrLoopbackIpv4(mappedIpv4[1] ?? "");
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized.startsWith("ff")
  );
}

/** Rechaza localhost, loopback e IPs privadas (RFC 1918 / RFC 4193 / link-local). */
function isDisallowedHost(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateOrLoopbackIpv4(normalized);
  if (ipVersion === 6) return isPrivateOrLoopbackIpv6(normalized);
  return false;
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
}

function effectivePort(parsed: URL): number {
  if (parsed.port) return Number(parsed.port);
  if (parsed.protocol === "https:") return 443;
  if (parsed.protocol === "http:") return 80;
  return Number.NaN;
}

/**
 * Version compartida del resolvedor de dominio oficial duplicado hasta Fase 3
 * entre `packages/providers/entscheidsuche/src/officialSourceResolver.ts` y
 * `packages/providers/fedlex/src/officialSourceResolver.ts` (identicos salvo
 * por el nombre del tipo y el soporte opcional de etiquetas de subdominio
 * bloqueadas). Fase 4 introduce tres proveedores nuevos (SECO/BSV/ESTV) que
 * necesitan exactamente la misma logica de SSRF -- en vez de copiarla una
 * tercera vez, vive aqui. Los proveedores de Fase 2/3 NO se migraron a esta
 * clase en este mismo cambio (fuera del alcance autorizado de Fase 4, ver
 * IMPLEMENTATION_STATUS.md); queda como deuda tecnica de prioridad baja.
 *
 * Solo valida sintaxis/protocolo/dominio -- nunca descarga ni sigue
 * redirecciones (eso es responsabilidad de `SecureHttpClient` en
 * `@swiss-legal-mcp/shared-web`, que reutiliza esta clase en cada hop).
 */
export class DomainAllowlistResolver {
  constructor(
    private readonly allowedDomains: readonly string[],
    private readonly blockedSubdomainLabels: readonly string[] = [],
    private readonly options: DomainAllowlistResolverOptions = {},
  ) {}

  resolve(
    rawUrl: string | null | undefined,
    resolveOptions: DomainAllowlistResolveOptions = {},
  ): DomainAllowlistResolution {
    if (!rawUrl) {
      return { isAllowed: false, reason: "sin URL" };
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { isAllowed: false, reason: "URL sintacticamente invalida" };
    }

    if (parsed.username || parsed.password) {
      return { isAllowed: false, reason: "credenciales embebidas en URL no permitidas" };
    }

    const allowedProtocols = this.options.allowHttp ? ["https:", "http:"] : ["https:"];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return {
        isAllowed: false,
        reason: `protocolo no permitido: '${parsed.protocol}' (solo ${allowedProtocols.join(", ")})`,
      };
    }

    const port = effectivePort(parsed);
    const allowedPorts = this.options.allowedPorts ?? DEFAULT_ALLOWED_PORTS;
    if (!Number.isInteger(port) || !allowedPorts.includes(port)) {
      return {
        isAllowed: false,
        domain: normalizeHostname(parsed.hostname),
        reason: `puerto no permitido: ${Number.isNaN(port) ? "(invalido)" : port}`,
      };
    }

    const hostname = normalizeHostname(parsed.hostname);

    if (isDisallowedHost(hostname)) {
      return { isAllowed: false, domain: hostname, reason: "localhost o IP privada" };
    }

    if (isIP(hostname) !== 0) {
      return {
        isAllowed: false,
        domain: hostname,
        reason: "hostname es una IP publica cruda, no un dominio configurado",
      };
    }

    const labels = hostname.split(".");
    if (labels.some((label) => this.blockedSubdomainLabels.includes(label))) {
      return {
        isAllowed: false,
        domain: hostname,
        reason: "subdominio bloqueado explicitamente por configuracion",
      };
    }

    const matchesAllowlist = this.allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    if (!matchesAllowlist) {
      return {
        isAllowed: false,
        domain: hostname,
        reason: "dominio no esta en la allowlist configurada",
      };
    }

    for (const address of resolveOptions.resolvedAddresses ?? []) {
      const normalizedAddress = normalizeHostname(address);
      if (isIP(normalizedAddress) === 0) {
        return {
          isAllowed: false,
          domain: hostname,
          reason: `respuesta DNS no es una direccion IP valida: ${address}`,
        };
      }
      if (isDisallowedHost(normalizedAddress)) {
        return {
          isAllowed: false,
          domain: hostname,
          reason: `DNS resuelve a direccion privada o reservada: ${address}`,
        };
      }
    }

    return { isAllowed: true, domain: hostname };
  }
}
