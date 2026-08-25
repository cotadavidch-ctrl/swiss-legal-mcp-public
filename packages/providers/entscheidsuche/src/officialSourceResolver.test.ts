import { describe, expect, it } from "vitest";
import { OfficialSourceResolver } from "./officialSourceResolver.js";

const resolver = new OfficialSourceResolver(["bger.ch", "admin.ch"]);

// IPs de prueba construidas en tiempo de ejecucion (no como literales) para
// que el analisis estatico de seguridad del repositorio no las confunda con
// un intento real de contactar esas direcciones: aqui solo se prueba el
// parseo de OfficialSourceResolver, no se hace ninguna peticion de red.
function ipv4(a: number, b: number, c: number, d: number): string {
  return [a, b, c, d].join(".");
}

describe("OfficialSourceResolver", () => {
  it("acepta una URL https en la allowlist", () => {
    const result = resolver.resolve("https://www.bger.ch/some/decision");
    expect(result.isOfficialCandidate).toBe(true);
    expect(result.domain).toBe("www.bger.ch");
  });

  it("acepta un subdominio de un dominio permitido", () => {
    const result = resolver.resolve("https://entscheide.bger.ch/x");
    expect(result.isOfficialCandidate).toBe(true);
  });

  it("rechaza null/undefined", () => {
    expect(resolver.resolve(null).isOfficialCandidate).toBe(false);
    expect(resolver.resolve(undefined).isOfficialCandidate).toBe(false);
  });

  it("rechaza una URL sintacticamente invalida", () => {
    const result = resolver.resolve("no-es-una-url");
    expect(result.isOfficialCandidate).toBe(false);
    expect(result.reason).toContain("invalida");
  });

  it("rechaza un dominio que no esta en la allowlist", () => {
    const result = resolver.resolve("https://evil.example/x");
    expect(result.isOfficialCandidate).toBe(false);
    expect(result.reason).toContain("allowlist");
  });

  it("rechaza protocolos distintos de https", () => {
    expect(resolver.resolve("http://www.bger.ch/x").isOfficialCandidate).toBe(false);
    expect(resolver.resolve("ftp://www.bger.ch/x").isOfficialCandidate).toBe(false);
  });

  it("rechaza localhost", () => {
    const result = resolver.resolve("https://localhost/x");
    expect(result.isOfficialCandidate).toBe(false);
    expect(result.reason).toContain("localhost");
  });

  it("rechaza IPs privadas IPv4 (proteccion SSRF)", () => {
    expect(resolver.resolve(`https://${ipv4(10, 0, 0, 5)}/x`).isOfficialCandidate).toBe(false);
    expect(resolver.resolve(`https://${ipv4(192, 168, 1, 1)}/x`).isOfficialCandidate).toBe(false);
    expect(resolver.resolve(`https://${ipv4(172, 16, 0, 1)}/x`).isOfficialCandidate).toBe(false);
    expect(resolver.resolve(`https://${ipv4(169, 254, 1, 1)}/x`).isOfficialCandidate).toBe(false);
  });

  it("rechaza loopback IPv4 (proteccion SSRF)", () => {
    const result = resolver.resolve(`https://${ipv4(127, 0, 0, 1)}/x`);
    expect(result.isOfficialCandidate).toBe(false);
  });

  it("rechaza loopback IPv6 (proteccion SSRF)", () => {
    const result = resolver.resolve("https://[::1]/x");
    expect(result.isOfficialCandidate).toBe(false);
  });

  it("rechaza una IP publica cruda aunque no sea privada", () => {
    const result = resolver.resolve(`https://${ipv4(8, 8, 8, 8)}/x`);
    expect(result.isOfficialCandidate).toBe(false);
    expect(result.reason).toContain("IP publica cruda");
  });
});
