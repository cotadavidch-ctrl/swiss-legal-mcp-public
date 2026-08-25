import { isIP } from "node:net";

export interface OfficialSourceResolution {
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

/**
 * Rechaza localhost, loopback e IPs privadas (RFC 1918 / RFC 4193 / link-local),
 * en cualquier familia detectada por node:net.isIP.
 */
function isDisallowedHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) return isPrivateOrLoopbackIpv4(hostname);
  if (ipVersion === 6) return isPrivateOrLoopbackIpv6(hostname);
  // Cualquier hostname que no sea IP pero "parezca" IP mal formada ya fue
  // descartado antes por isIP devolviendo 0; en ese caso no es una IP, es
  // un nombre de dominio normal y esta funcion no debe bloquearlo aqui.
  return false;
}

/**
 * Valida sintacticamente si una URL devuelta por un proveedor (entscheidsuche.ch
 * u otro agregador) puede tratarse como candidata a "fuente oficial". NO
 * descarga ni seg sigue redirecciones -- ver docs/providers/entscheidsuche.md.
 * Un resultado `isOfficialCandidate: true` NUNCA implica verificacion de
 * contenido, solo que la URL es sintacticamente segura y su dominio esta en
 * la allowlist configurada.
 */
export class OfficialSourceResolver {
  constructor(private readonly allowedDomains: readonly string[]) {}

  resolve(rawUrl: string | null | undefined): OfficialSourceResolution {
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
        reason: "hostname es una IP publica cruda, no un dominio judicial",
      };
    }

    const matchesAllowlist = this.allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    if (!matchesAllowlist) {
      return {
        isOfficialCandidate: false,
        domain: hostname,
        reason: "dominio no esta en la allowlist configurada",
      };
    }

    return { isOfficialCandidate: true, domain: hostname };
  }
}
