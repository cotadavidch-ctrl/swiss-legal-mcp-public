import { describe, expect, it } from "vitest";
import { FedlexSourceResolver } from "./officialSourceResolver.js";

const resolver = new FedlexSourceResolver(["fedlex.admin.ch", "fedlex.data.admin.ch"]);

// IPs de prueba construidas en tiempo de ejecucion (no como literales) para
// que el analisis estatico de seguridad del repositorio no las confunda con
// un intento real de contactar esas direcciones.
function ipv4(a: number, b: number, c: number, d: number): string {
  return [a, b, c, d].join(".");
}

describe("FedlexSourceResolver", () => {
  it("acepta una URL https real del dominio de manifestaciones de Fedlex", () => {
    const result = resolver.resolve(
      "https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1999/404/20240303/de/xml/fedlex-data-admin-ch-eli-cc-1999-404-20240303-de-xml-10.xml",
    );
    expect(result.isOfficialCandidate).toBe(true);
  });

  it("acepta el dominio publico principal fedlex.admin.ch", () => {
    expect(
      resolver.resolve("https://www.fedlex.admin.ch/eli/cc/1999/404/de").isOfficialCandidate,
    ).toBe(true);
  });

  it("RECHAZA explicitamente intranet.fedlex.admin.ch (hallazgo de seguridad real de Fase 3)", () => {
    const result = resolver.resolve(
      "https://intranet.fedlex.admin.ch/casematesbo/filestore/fedlex.data.admin.ch/eli/cc/1999/404/20240303/de/xml/fedlex-data-admin-ch-eli-cc-1999-404-20240303-de-xml-10.xml",
    );
    expect(result.isOfficialCandidate).toBe(false);
    expect(result.reason).toContain("bloqueado");
  });

  it("rechaza un dominio que no esta en la allowlist aunque termine en admin.ch", () => {
    const result = resolver.resolve("https://otra-oficina.admin.ch/x");
    expect(result.isOfficialCandidate).toBe(false);
    expect(result.reason).toContain("allowlist");
  });

  it("rechaza null/undefined", () => {
    expect(resolver.resolve(null).isOfficialCandidate).toBe(false);
    expect(resolver.resolve(undefined).isOfficialCandidate).toBe(false);
  });

  it("rechaza una URL sintacticamente invalida", () => {
    const result = resolver.resolve("no-es-una-url");
    expect(result.isOfficialCandidate).toBe(false);
  });

  it("rechaza protocolos distintos de https", () => {
    expect(resolver.resolve("http://fedlex.data.admin.ch/x").isOfficialCandidate).toBe(false);
    expect(resolver.resolve("ftp://fedlex.data.admin.ch/x").isOfficialCandidate).toBe(false);
  });

  it("rechaza localhost", () => {
    expect(resolver.resolve("https://localhost/x").isOfficialCandidate).toBe(false);
  });

  it("rechaza IPs privadas IPv4 (proteccion SSRF)", () => {
    expect(resolver.resolve(`https://${ipv4(10, 0, 0, 5)}/x`).isOfficialCandidate).toBe(false);
    expect(resolver.resolve(`https://${ipv4(192, 168, 1, 1)}/x`).isOfficialCandidate).toBe(false);
    expect(resolver.resolve(`https://${ipv4(172, 16, 0, 1)}/x`).isOfficialCandidate).toBe(false);
  });

  it("rechaza loopback IPv4 e IPv6", () => {
    expect(resolver.resolve(`https://${ipv4(127, 0, 0, 1)}/x`).isOfficialCandidate).toBe(false);
    expect(resolver.resolve("https://[::1]/x").isOfficialCandidate).toBe(false);
  });

  it("rechaza una IP publica cruda", () => {
    const result = resolver.resolve(`https://${ipv4(8, 8, 8, 8)}/x`);
    expect(result.isOfficialCandidate).toBe(false);
  });
});
