import { isIP } from "node:net";

export interface FedlexSourceResolution {
  readonly isOfficialCandidate: boolean;
  readonly domain?: string;
  readonly reason?: string;
}

const PRIVATE_IPV4_RANGES: ReadonlyArray<(octets: number[]) => boolean> = [
  (o) => o[0] === 10,
  (o) => o[0] === 127,
  (o) => o[0] === 169 && o[1] === 254,
  (o) => o[0] === 172 && (o[1] ?? 0) >= 16 && (o[1] ?? 0) <= 31,
  (o) => o[0] === 192 && o[1] === 168,
  (o) => o[0] === 0,
];

function isPrivateOrLoopbackIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n))) return false;
  return PRIVATE_IPV4_RANGES.some((check) => check(octets));
}

function isPrivateOrLoopbackIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

function isDisallowedHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) return isPrivateOrLoopbackIpv4(hostname);
  if (ipVersion === 6) return isPrivateOrLoopbackIpv6(hostname);
  return false;
}

/**
 * Etiqueta de subdominio bloqueada explicitamente: el hallazgo real de Fase 3
 * confirmo que `jolux:isExemplifiedByPrivate`/`jolux:wasExemplifiedByPrivate`
 * apuntan a `intranet.fedlex.admin.ch`, un dominio interno visible solo
 * porque el endpoint SPARQL publico expone esas triplas (ver
 * docs/provider-contracts/fedlex.md). Un simple `endsWith('.fedlex.admin.ch')`
 * NO basta para excluirlo -- "intranet.fedlex.admin.ch" termina exactamente
 * en ese sufijo. Por eso se bloquea la etiqueta "intranet" de forma expresa,
 * independientemente de que dominio de la allowlist coincida.
 */
const BLOCKED_SUBDOMAIN_LABELS: readonly string[] = ["intranet"];

/**
 * Resuelve si una URL de manifestacion devuelta por Fedlex (jolux:isExemplifiedBy)
 * puede tratarse como fuente oficial descargable. Solo valida sintaxis/dominio
 * -- no descarga ni sigue redirecciones. A diferencia de
 * packages/providers/entscheidsuche/src/officialSourceResolver.ts (que permite
 * cualquier subdominio de sus dominios judiciales), aqui la allowlist es mas
 * estricta porque el propio proveedor construye las URLs a partir de datos
 * verificados como oficiales -- nunca acepta URLs arbitrarias de terceros.
 */
export class FedlexSourceResolver {
  constructor(private readonly allowedDomains: readonly string[]) {}

  resolve(rawUrl: string | null | undefined): FedlexSourceResolution {
    if (!rawUrl) {
      return { isOfficialCandidate: false, reason: "sin URL" };
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { isOfficialCandidate: false, reason: "URL sintacticamente invalida" };
    }

    if (parsed.protocol !== "https:") {
      return {
        isOfficialCandidate: false,
        reason: `protocolo no permitido: '${parsed.protocol}' (solo https)`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (isDisallowedHost(hostname)) {
      return { isOfficialCandidate: false, domain: hostname, reason: "localhost o IP privada" };
    }

    if (isIP(hostname) !== 0) {
      return {
        isOfficialCandidate: false,
        domain: hostname,
        reason: "hostname es una IP publica cruda, no un dominio de Fedlex",
      };
    }

    const labels = hostname.split(".");
    if (labels.some((label) => BLOCKED_SUBDOMAIN_LABELS.includes(label))) {
      return {
        isOfficialCandidate: false,
        domain: hostname,
        reason:
          "subdominio bloqueado explicitamente (dominio interno, ver hallazgo de seguridad Fase 3)",
      };
    }

    const matchesAllowlist = this.allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    if (!matchesAllowlist) {
      return {
        isOfficialCandidate: false,
        domain: hostname,
        reason: "dominio no esta en la allowlist configurada de Fedlex",
      };
    }

    return { isOfficialCandidate: true, domain: hostname };
  }
}
