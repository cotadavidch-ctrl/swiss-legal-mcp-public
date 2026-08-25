import { describe, expect, it } from "vitest";
import { inspectRdfSecurity } from "./rdfSecurity.js";

describe("inspectRdfSecurity", () => {
  it("acepta N-Triples pequeno sin referencias externas operativas", () => {
    const result = inspectRdfSecurity('_:a <urn:p> "valor" .\n', "ntriples");
    expect(result.status).toBe("safe");
    expect(result.estimatedTripleCount).toBe(1);
  });

  it("bloquea DTD y entidades en RDF/XML", () => {
    const xml =
      '<?xml version="1.0"?><!DOCTYPE rdf [<!ENTITY xxe SYSTEM "https://example.test/secret">]><rdf:RDF>&xxe;</rdf:RDF>';
    const result = inspectRdfSecurity(xml, "rdfxml");
    expect(result.status).toBe("blocked_external_reference");
    expect(result.warnings).toContain("xml_doctype");
    expect(result.warnings).toContain("external_entity");
  });

  it("bloquea imports y URLs remotas en Turtle", () => {
    const ttl = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
<urn:a> owl:imports <https://example.test/context.ttl> .`;
    const result = inspectRdfSecurity(ttl, "turtle");
    expect(result.status).toBe("blocked_external_reference");
    expect(result.warnings).toContain("external_import");
  });

  it("bloquea contextos JSON-LD remotos sin descargarlos", () => {
    const result = inspectRdfSecurity(
      JSON.stringify({ "@context": "https://example.test/context.jsonld", "@id": "urn:a" }),
      "jsonld",
    );
    expect(result.status).toBe("blocked_external_reference");
    expect(result.warnings).toContain("external_jsonld_context");
  });

  it("rechaza tamano, profundidad y blank nodes excesivos", () => {
    expect(inspectRdfSecurity("x".repeat(20), "turtle", { maxBytes: 5 }).status).toBe("too_large");

    const deep = JSON.stringify({ "@id": "urn:a", child: { child: { child: {} } } });
    expect(inspectRdfSecurity(deep, "jsonld", { maxDepth: 2 }).status).toBe("too_complex");

    const blankNodes = Array.from({ length: 4 }, (_, index) => `_:b${index} <urn:p> "x" .`).join(
      "\n",
    );
    expect(inspectRdfSecurity(blankNodes, "ntriples", { maxBlankNodes: 2 }).status).toBe(
      "too_complex",
    );
  });
});
