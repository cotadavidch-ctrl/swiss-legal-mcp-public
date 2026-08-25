import { describe, expect, it } from "vitest";
import { DomainAllowlistResolver } from "./domainAllowlistResolver.js";

describe("DomainAllowlistResolver", () => {
  const resolver = new DomainAllowlistResolver(["www.arbeit.swiss", "backend.arbeit.swiss"]);

  it("acepta un dominio exacto de la allowlist", () => {
    const result = resolver.resolve("https://www.arbeit.swiss/de/publikationen");
    expect(result.isAllowed).toBe(true);
    expect(result.domain).toBe("www.arbeit.swiss");
  });

  it("acepta un subdominio de un dominio permitido", () => {
    const result = resolver.resolve("https://sub.backend.arbeit.swiss/x.pdf");
    expect(result.isAllowed).toBe(true);
  });

  it("rechaza un dominio fuera de la allowlist", () => {
    const result = resolver.resolve("https://evil.example.com/x");
    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("allowlist");
  });

  it("rechaza protocolo distinto de https", () => {
    const result = resolver.resolve("http://www.arbeit.swiss/x");
    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("protocolo");
  });

  it("permite puerto 443 explicito e implicito", () => {
    expect(resolver.resolve("https://www.arbeit.swiss/x").isAllowed).toBe(true);
    expect(resolver.resolve("https://www.arbeit.swiss:443/x").isAllowed).toBe(true);
  });

  it("permite HTTP/80 solo cuando existe excepcion explicita", () => {
    const httpResolver = new DomainAllowlistResolver(["example.test"], [], {
      allowHttp: true,
      allowedPorts: [80, 443],
    });
    expect(httpResolver.resolve("http://example.test/x").isAllowed).toBe(true);
    expect(resolver.resolve("http://www.arbeit.swiss:80/x").isAllowed).toBe(false);
  });

  it("bloquea puertos arbitrarios y administrativos", () => {
    for (const port of [22, 3000, 8080]) {
      const result = resolver.resolve(`https://www.arbeit.swiss:${port}/x`);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain("puerto");
    }
  });

  it("bloquea credenciales embebidas en URL", () => {
    const result = resolver.resolve("https://user:pass@www.arbeit.swiss/x");
    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("credenciales");
  });

  it("rechaza localhost", () => {
    const result = resolver.resolve("https://localhost/x");
    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("privada");
  });

  it("rechaza IPs privadas RFC 1918", () => {
    const privateHosts = ["10.0.0.1", "192.168.1.1", "172.16.0.1", "100.64.0.1"];
    for (const host of privateHosts) {
      expect(resolver.resolve(`https://${host}/x`).isAllowed).toBe(false);
    }
  });

  it("rechaza IPv6 loopback, link-local, multicast e IPv4-mapped privado", () => {
    const hosts = ["[::1]", "[fe80::1]", "[ff02::1]", "[::ffff:127.0.0.1]"];
    for (const host of hosts) {
      expect(resolver.resolve(`https://${host}:443/x`).isAllowed).toBe(false);
    }
  });

  it("rechaza una IP publica cruda (no es un nombre de dominio)", () => {
    const publicHost = ["8", "8", "8", "8"].join(".");
    const result = resolver.resolve(`https://${publicHost}/x`);
    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("IP publica cruda");
  });

  it("rechaza URL sintacticamente invalida", () => {
    expect(resolver.resolve("no-es-una-url").isAllowed).toBe(false);
  });

  it("rechaza ausencia de URL", () => {
    expect(resolver.resolve(undefined).isAllowed).toBe(false);
    expect(resolver.resolve(null).isAllowed).toBe(false);
  });

  it("bloquea etiquetas de subdominio explicitamente prohibidas", () => {
    const withBlocklist = new DomainAllowlistResolver(["estv.admin.ch"], ["intranet"]);
    const result = withBlocklist.resolve("https://intranet.estv.admin.ch/x");
    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("bloqueado");
  });

  it("bloquea un hostname publico allowlisted si DNS resuelve a direcciones privadas", () => {
    const result = resolver.resolve("https://www.arbeit.swiss/x", {
      resolvedAddresses: ["93.184.216.34", "10.0.0.10"],
    });
    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("DNS resuelve");
  });

  it("acepta IPv6 con puerto cuando el dominio y la direccion resuelta son publicos", () => {
    const result = resolver.resolve("https://www.arbeit.swiss:443/x", {
      resolvedAddresses: ["2606:2800:220:1:248:1893:25c8:1946"],
    });
    expect(result.isAllowed).toBe(true);
  });
});
