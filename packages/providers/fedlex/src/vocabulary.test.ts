import { describe, expect, it } from "vitest";
import {
  FedlexVocabularyError,
  parseInForceStatusUri,
  parseLanguageUri,
  parseUserFormatUri,
} from "./vocabulary.js";

describe("parseLanguageUri (codigos reales verificados en vivo)", () => {
  it("mapea de/fr/it/rm/en a nuestro enum", () => {
    expect(parseLanguageUri("http://publications.europa.eu/resource/authority/language/DEU")).toBe(
      "de",
    );
    expect(parseLanguageUri("http://publications.europa.eu/resource/authority/language/FRA")).toBe(
      "fr",
    );
    expect(parseLanguageUri("http://publications.europa.eu/resource/authority/language/ITA")).toBe(
      "it",
    );
    expect(parseLanguageUri("http://publications.europa.eu/resource/authority/language/ROH")).toBe(
      "rm",
    );
    expect(parseLanguageUri("http://publications.europa.eu/resource/authority/language/ENG")).toBe(
      "en",
    );
  });

  it("rechaza un codigo no observado en vez de adivinar", () => {
    expect(() =>
      parseLanguageUri("http://publications.europa.eu/resource/authority/language/RON"),
    ).toThrow(FedlexVocabularyError);
  });

  it("rechaza una URI con prefijo distinto", () => {
    expect(() => parseLanguageUri("https://example.test/lang/DEU")).toThrow(FedlexVocabularyError);
  });
});

describe("parseInForceStatusUri (vocabulario real jolux:inForceStatus)", () => {
  it("mapea 0-3 segun las etiquetas reales verificadas", () => {
    expect(
      parseInForceStatusUri("https://fedlex.data.admin.ch/vocabulary/enforcement-status/0"),
    ).toBe("in_force");
    expect(
      parseInForceStatusUri("https://fedlex.data.admin.ch/vocabulary/enforcement-status/1"),
    ).toBe("no_longer_published");
    expect(
      parseInForceStatusUri("https://fedlex.data.admin.ch/vocabulary/enforcement-status/2"),
    ).toBe("not_applicable");
    expect(
      parseInForceStatusUri("https://fedlex.data.admin.ch/vocabulary/enforcement-status/3"),
    ).toBe("no_longer_in_force");
  });

  it("mapea el valor 4 (sin etiqueta observada) a 'other' en vez de inventar un significado", () => {
    expect(
      parseInForceStatusUri("https://fedlex.data.admin.ch/vocabulary/enforcement-status/4"),
    ).toBe("other");
  });
});

describe("parseUserFormatUri (vocabulario real jolux:userFormat)", () => {
  it("mapea xml/html/docx/doc directamente", () => {
    expect(parseUserFormatUri("https://fedlex.data.admin.ch/vocabulary/user-format/xml")).toBe(
      "xml",
    );
    expect(parseUserFormatUri("https://fedlex.data.admin.ch/vocabulary/user-format/html")).toBe(
      "html",
    );
  });

  it("normaliza pdf-a a nuestro 'pdf'", () => {
    expect(parseUserFormatUri("https://fedlex.data.admin.ch/vocabulary/user-format/pdf-a")).toBe(
      "pdf",
    );
  });

  it("rechaza un formato no reconocido", () => {
    expect(() =>
      parseUserFormatUri("https://fedlex.data.admin.ch/vocabulary/user-format/rtf"),
    ).toThrow(FedlexVocabularyError);
  });
});
