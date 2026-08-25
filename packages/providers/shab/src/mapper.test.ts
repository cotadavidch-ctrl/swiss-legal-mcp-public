import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mapShabPublicationToNormalizedDocument } from "./mapper.js";
import { shabRemoteListResponseSchema, type ShabRemotePublication } from "./remoteTypes.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/shab",
);

function loadPublication(fixtureName: string, index = 0): ShabRemotePublication {
  const raw: unknown = JSON.parse(readFileSync(path.join(fixturesDir, fixtureName), "utf8"));
  const parsed = shabRemoteListResponseSchema.parse(raw);
  const publication = parsed.content[index];
  if (!publication)
    throw new Error(`Fixture '${fixtureName}' no tiene entrada en el indice ${index}.`);
  return publication;
}

const OPTIONS = {
  sourceUrl: "https://www.shab.ch/api/v1/publications",
  retrievedAt: "2026-07-27T12:00:00.000Z",
  contentHash: "a".repeat(64),
};

describe("shabRemoteListResponseSchema", () => {
  it("valida la respuesta real de la rubrica HR (mutaciones de sociedades)", () => {
    const publication = loadPublication("publications_hr_sample.json");
    expect(publication.meta.rubric).toBe("HR");
  });

  it("valida la respuesta real de la rubrica KK (quiebras, con datos personales redactados)", () => {
    const publication = loadPublication("publications_kk_sample_redacted.json");
    expect(publication.meta.rubric).toBe("KK");
  });
});

describe("mapShabPublicationToNormalizedDocument", () => {
  it("normaliza una publicacion real de rubrica HR sin affectedEntity (son mutaciones de sociedades, sin bloque debtor)", () => {
    const publication = loadPublication("publications_hr_sample.json");
    const doc = mapShabPublicationToNormalizedDocument(publication, OPTIONS);

    expect(doc.documentType).toBe("shab_entry");
    expect(doc.provider).toBe("shab");
    expect(doc.provenance.officialCharacter).toBe("official");
    expect(doc.shabPublication?.rubric).toBe("HR");
    expect(doc.shabPublication?.publicationState).toBe("published");
    expect(doc.shabPublication?.cantons).toEqual(["ZG"]);
    expect(doc.shabPublication?.affectedEntity).toBeUndefined();
  });

  it("normaliza una publicacion real de rubrica KK con affectedEntity de tipo person (datos redactados)", () => {
    const publication = loadPublication("publications_kk_sample_redacted.json");
    const doc = mapShabPublicationToNormalizedDocument(publication, OPTIONS);

    expect(doc.shabPublication?.rubric).toBe("KK");
    expect(doc.shabPublication?.affectedEntity?.type).toBe("person");
    expect(doc.shabPublication?.legalBasisText).toContain("art. 221");
  });

  it("nunca inventa relatedPublicationIds cuando la fuente no los declara", () => {
    const publication = loadPublication("publications_hr_sample.json");
    const doc = mapShabPublicationToNormalizedDocument(publication, OPTIONS);
    expect(doc.shabPublication?.relatedPublicationIds).toBeUndefined();
  });

  it("selecciona el titulo del idioma solicitado entre los 4 reales disponibles", () => {
    const publication = loadPublication("publications_hr_sample.json");
    const docFr = mapShabPublicationToNormalizedDocument(publication, {
      ...OPTIONS,
      language: "fr",
    });
    expect(docFr.title).toContain("Mutation");
  });
});
