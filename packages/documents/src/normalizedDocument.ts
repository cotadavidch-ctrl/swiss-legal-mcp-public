import { z } from "zod";

/**
 * Esquema del documento juridico normalizado. Ver docs/data-model.md en la
 * raiz del repositorio para la justificacion de cada campo. Ningun proveedor
 * puede rellenar un campo ausente con un valor inventado: si el dato no
 * existe en la fuente, el campo se omite.
 */

export const jurisdictionLevelSchema = z.enum(["federal", "cantonal", "municipal"]);
export type JurisdictionLevel = z.infer<typeof jurisdictionLevelSchema>;

export const languageSchema = z.enum(["de", "fr", "it", "rm", "en"]);
export type Language = z.infer<typeof languageSchema>;

export const documentTypeSchema = z.enum([
  "case",
  "legislation_article",
  "legislation_law",
  "official_publication",
  "shab_entry",
  "company_record",
  "administrative_circular",
]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const contentNatureSchema = z.enum(["literal", "summary", "inference"]);
export type ContentNature = z.infer<typeof contentNatureSchema>;

export const officialCharacterSchema = z.enum(["official", "unofficial_aggregator"]);
export type OfficialCharacter = z.infer<typeof officialCharacterSchema>;

/**
 * Vocabulario jolux:inForceStatus verificado en vivo contra Fedlex (Fase 3,
 * ver docs/provider-contracts/fedlex.md): 0=vigente, 1=ya no publicada en la
 * SR/RS, 2=sin objeto, 3=ya no vigente. "other" cubre el valor 4 (no
 * resuelto en la auditoria) y cualquier valor futuro no catalogado, para no
 * fallar si Fedlex agrega un estado nuevo.
 */
export const inForceStatusSchema = z.enum([
  "in_force",
  "no_longer_published",
  "not_applicable",
  "no_longer_in_force",
  "other",
]);
export type InForceStatus = z.infer<typeof inForceStatusSchema>;

/**
 * Formatos de manifestacion observados en vivo para consolidaciones de
 * Fedlex (jolux:userFormat). "doc"/"pdf" son los unicos disponibles para
 * versiones anteriores al hueco historico documentado (ver
 * docs/provider-contracts/fedlex.md).
 */
export const legislationFormatSchema = z.enum(["xml", "html", "pdf", "docx", "doc"]);
export type LegislationFormat = z.infer<typeof legislationFormatSchema>;

export const amendingActReferenceSchema = z.object({
  eli: z.string().url().optional(),
  systematicNumber: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  date: z.iso.date().optional(),
});
export type AmendingActReference = z.infer<typeof amendingActReferenceSchema>;

export const legislationArticleLocationSchema = z.object({
  articleNumber: z.string().min(1),
  paragraph: z.string().min(1).optional(),
  letter: z.string().min(1).optional(),
  annex: z.string().min(1).optional(),
});
export type LegislationArticleLocation = z.infer<typeof legislationArticleLocationSchema>;

/**
 * Metadatos especificos de legislacion federal (Fedlex, Fase 3). Modela la
 * cadena FRBR Work (acto) -> Consolidation (version fechada) -> Expression
 * (idioma) -> Manifestation (formato concreto) tal como se verifico en vivo
 * (ver docs/provider-contracts/fedlex.md). Ningun campo se rellena con un
 * valor inventado: si Fedlex no expone el dato (p.ej. referencia BBl/FF), el
 * campo queda ausente.
 */
export const legislationMetadataSchema = z.object({
  eli: z.string().url(),
  /** Numero RS/SR (jolux:historicalLegalId). No es unico en el tiempo: ver
   * el caso real RS 832.10 documentado en docs/provider-contracts/fedlex.md. */
  systematicNumber: z.string().min(1).optional(),
  /** Titulo canonico a nivel de Work (ConsolidationAbstract), nunca el
   * titulo generico que puede aparecer en una Consolidation historica. */
  workTitle: z.string().min(1),
  expressionLanguage: languageSchema,
  version: z.object({
    /** jolux:dateApplicability de la Consolidation elegida. */
    date: z.iso.date(),
    /** jolux:dateEndApplicability. Ausente = version vigente o futura sin sucesora conocida aun. */
    endDate: z.iso.date().optional(),
    isHistorical: z.boolean(),
    /** true solo si se verifico una manifestacion Akoma Ntoso/XML real para esta version concreta. */
    structuredFormatAvailable: z.boolean(),
  }),
  manifestation: z
    .object({
      format: legislationFormatSchema,
      url: z.string().url(),
    })
    .optional(),
  inForceStatus: inForceStatusSchema,
  entryIntoForceDate: z.iso.date().optional(),
  repealDate: z.iso.date().optional(),
  /** Cita AS/RO (p.ej. "RO 1999 2556"). */
  officialCompilationReference: z.string().min(1).optional(),
  /** Referencia BBl/FF. No se confirmo ninguna en la auditoria de Fase 3;
   * el campo se modela igualmente y queda ausente hasta que se observe una real. */
  federalGazetteReference: z.string().min(1).optional(),
  amendingActs: z.array(amendingActReferenceSchema).optional(),
  /** Presente solo cuando documentType es "legislation_article". */
  articleLocation: legislationArticleLocationSchema.optional(),
});
export type LegislationMetadata = z.infer<typeof legislationMetadataSchema>;

/**
 * Sub-clasificacion real de un documento administrativo (Fase 4: SECO, BSV,
 * ESTV). Todos comparten documentType "administrative_circular"; este campo
 * distingue el tipo real de documento dentro de ese mismo cubo (una
 * circular, un formulario descargable, una nota informativa...). No crea
 * documentTypes nuevos por cada variante -- ver docs/data-model.md.
 */
export const administrativeDocumentTypeSchema = z.enum([
  "circular",
  "directive",
  "instruction",
  "guidance",
  "practice",
  "information_notice",
  "technical_notice",
  "faq",
  "form",
  "report",
  "other",
]);
export type AdministrativeDocumentType = z.infer<typeof administrativeDocumentTypeSchema>;

/**
 * Estado real declarado por la fuente. "unknown" cuando el proveedor no
 * pudo determinarlo (nunca se asume "current" por defecto).
 */
export const administrativeCircularStatusSchema = z.enum([
  "current",
  "superseded",
  "withdrawn",
  "unknown",
]);
export type AdministrativeCircularStatus = z.infer<typeof administrativeCircularStatusSchema>;

/**
 * Caracter vinculante SOLO cuando la propia fuente lo declara
 * explicitamente (p.ej. muchas Weisungen de BSV/SECO se autodescriben como
 * "sin caracter de norma juridica"/"ohne Rechtssatzcharakter"). Este campo
 * queda ausente -- nunca se rellena con un valor por defecto -- cuando la
 * fuente no se pronuncia. Ningun proveedor puede inferir "binding" o
 * "non_binding" a partir del tipo de documento o de su formato.
 */
export const declaredBindingCharacterSchema = z.enum([
  "binding",
  "non_binding",
  "administrative_guidance_only",
]);
export type DeclaredBindingCharacter = z.infer<typeof declaredBindingCharacterSchema>;

/**
 * Metadatos especificos de documentacion administrativa federal (Fase 4:
 * SECO, BSV/OFAS, ESTV/AFC). Ningun campo se rellena con un valor
 * inventado ni inferido: si la fuente no declara una relacion de
 * sustitucion, una fecha o un caracter vinculante, el campo queda ausente.
 */
export const administrativeCircularMetadataSchema = z.object({
  /** Oficina/departamento concreto dentro de la autoridad emisora (ver
   * tambien el campo `authority` de nivel superior para la autoridad en si,
   * p.ej. authority="SECO", department="Direccion del trabajo"). */
  department: z.string().min(1).optional(),
  administrativeDocumentType: administrativeDocumentTypeSchema,
  referenceNumber: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  issuedDate: z.iso.date().optional(),
  effectiveDate: z.iso.date().optional(),
  /** Fecha en la que este documento fue sustituido por otro (si la fuente la declara). */
  supersededDate: z.iso.date().optional(),
  status: administrativeCircularStatusSchema,
  subjects: z.array(z.string().min(1)).optional(),
  /** Referencias de texto libre a leyes/articulos relacionados (p.ej. "LACI Art. 30"). */
  relatedLegalProvisions: z.array(z.string().min(1)).optional(),
  /**
   * Documentos que ESTE documento sustituye, y el documento que sustituye a
   * ESTE (cuando status es "superseded"). SOLO se rellenan cuando la fuente
   * declara explicitamente la relacion -- nunca se infiere por titulos
   * parecidos ni por proximidad de fecha.
   */
  supersedesDocuments: z.array(z.string().min(1)).optional(),
  supersededByDocument: z.string().min(1).optional(),
  /** Ambito territorial de aplicacion declarado por la fuente (distinto de
   * `jurisdiction`, que describe donde reside la autoridad emisora, no
   * donde se aplica el documento). */
  territorialScope: z.string().min(1).optional(),
  /** Ausente = la fuente no declara caracter vinculante; nunca se infiere. */
  declaredBindingCharacter: declaredBindingCharacterSchema.optional(),
});
export type AdministrativeCircularMetadata = z.infer<typeof administrativeCircularMetadataSchema>;

/**
 * Estado real de una publicacion SHAB tal como lo declara la API del
 * Amtsblattportal (`meta.publicationState`, ver docs/provider-contracts/shab.md):
 * "PUBLISHED"/"CANCELLED" observados en vivo, mapeados aqui en minusculas
 * por consistencia con el resto del esquema.
 */
export const shabPublicationStateSchema = z.enum(["published", "cancelled"]);
export type ShabPublicationState = z.infer<typeof shabPublicationStateSchema>;

/**
 * Entidad afectada por una publicacion SHAB (empresa o persona fisica,
 * ver hallazgo real de Fase 5: la rubrica KK expone datos personales
 * reales de individuos). Todos los campos opcionales -- ninguno se rellena
 * si la fuente no lo declara explicitamente. `type` distingue el caso para
 * que el llamador pueda aplicar reglas de privacidad mas estrictas cuando
 * sea "person" (ver docs/providers/shab.md sobre riesgos de privacidad).
 */
export const shabAffectedEntitySchema = z.object({
  type: z.enum(["company", "person", "other"]).optional(),
  displayName: z.string().min(1).optional(),
  uid: z.string().min(1).optional(),
  chId: z.string().min(1).optional(),
});
export type ShabAffectedEntity = z.infer<typeof shabAffectedEntitySchema>;

export const shabRegistrationOfficeSchema = z.object({
  displayName: z.string().min(1),
  uid: z.string().min(1).optional(),
});
export type ShabRegistrationOffice = z.infer<typeof shabRegistrationOfficeSchema>;

/**
 * Metadatos especificos de una publicacion SHAB/FOSC/FUSC (Fase 5, ver
 * docs/provider-contracts/shab.md). `rubric`/`subRubric` son los codigos
 * reales de la fuente (p.ej. "HR"/"HR02", "KK"/"KK04"), nunca traducidos a
 * una taxonomia inventada. `relatedPublicationIds` SOLO se rellena cuando
 * la propia fuente declara la relacion (p.ej. `repeatedPublications`) --
 * nunca se infiere por similitud de titulo o proximidad de fecha.
 */
export const shabPublicationMetadataSchema = z.object({
  /** `meta.publicationNumber` real, p.ej. "HR02-1006716804". */
  publicationNumber: z.string().min(1),
  rubric: z.string().min(1),
  subRubric: z.string().min(1).optional(),
  publicationState: shabPublicationStateSchema,
  /** Numero de edicion del boletin impreso, cuando la fuente lo declara (ediciones historicas). */
  editionNumber: z.string().min(1).optional(),
  expirationDate: z.iso.date().optional(),
  affectedEntity: shabAffectedEntitySchema.optional(),
  registrationOffice: shabRegistrationOfficeSchema.optional(),
  /** Codigos de canton (2 letras) a los que aplica la publicacion; una publicacion puede afectar a varios. */
  cantons: z.array(z.string().length(2)).optional(),
  /** Base legal citada en texto libre por la fuente (`meta.legalRemedy`), nunca resuelta a un articulo estructurado. */
  legalBasisText: z.string().min(1).optional(),
  /** Solo IDs de publicaciones que la propia fuente declara relacionadas (p.ej. repeatedPublications). */
  relatedPublicationIds: z.array(z.string().min(1)).optional(),
});
export type ShabPublicationMetadata = z.infer<typeof shabPublicationMetadataSchema>;

export const jurisdictionSchema = z
  .object({
    level: jurisdictionLevelSchema,
    canton: z.string().length(2).optional(),
    municipality: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.level === "federal" && value.canton !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["canton"],
        message: "Una jurisdiccion federal no debe tener canton.",
      });
    }
    if (value.level !== "municipal" && value.municipality !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["municipality"],
        message: "Solo una jurisdiccion municipal puede tener municipio.",
      });
    }
    if (value.level !== "federal" && value.canton === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["canton"],
        message: "Una jurisdiccion cantonal o municipal requiere canton.",
      });
    }
  });
export type Jurisdiction = z.infer<typeof jurisdictionSchema>;

export const provenanceSchema = z.object({
  sourceUrl: z.string().url(),
  downloadUrl: z.string().url().optional(),
  /**
   * URL del tribunal/autoridad de origen, SOLO cuando el proveedor pudo
   * detectarla en los datos de la fuente (nunca inferida ni construida por
   * nosotros). Presencia de este campo no implica verificacion: ver
   * OfficialSourceResolver en packages/providers/entscheidsuche, que solo
   * valida sintaxis/dominio, no descarga ni confirma el contenido.
   */
  officialSourceUrl: z.string().url().optional(),
  /**
   * URL del propio agregador (p.ej. entscheidsuche.ch) de la que se obtuvo
   * este documento. Obligatoria cuando officialCharacter es
   * 'unofficial_aggregator' (ver superRefine mas abajo).
   */
  aggregatorUrl: z.string().url().optional(),
  retrievedAt: z.iso.datetime(),
  contentHash: z.string().min(1),
  officialCharacter: officialCharacterSchema,
  aggregatorName: z.string().min(1).optional(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

export const normalizedDocumentSchema = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1),
    documentType: documentTypeSchema,
    jurisdiction: jurisdictionSchema,
    authority: z.string().min(1).optional(),

    caseNumber: z.string().min(1).optional(),
    bgeAtfDtf: z.string().min(1).optional(),
    ecli: z.string().min(1).optional(),
    sourceOriginalId: z.string().min(1),

    date: z.object({
      // Opcional desde Fase 2: la API de entscheidsuche.ch permite
      // decision_date == null (no observado en la muestra real de esta
      // fase, pero el esquema remoto lo permite). No inventar una fecha.
      decisionOrEnactment: z.iso.date().optional(),
      inForceFrom: z.iso.date().optional(),
      publicationDate: z.iso.date().optional(),
    }),
    /**
     * Opcional: algunas fuentes (p.ej. entscheidsuche.ch) no declaran el
     * idioma real del documento en su esquema de salida. No inventar un
     * valor cuando el proveedor no lo sabe con certeza (ver
     * docs/provider-contracts/entscheidsuche.md).
     */
    language: languageSchema.optional(),

    title: z.string().min(1),
    summary: z.string().min(1).optional(),
    fullText: z.string().min(1).optional(),
    excerptOnly: z.boolean().optional(),

    articlesCited: z.array(z.string().min(1)).optional(),
    decisionsCited: z.array(z.string().min(1)).optional(),
    outcome: z.string().min(1).optional(),

    /** Obligatorio cuando documentType es "legislation_law" o "legislation_article" (ver superRefine). */
    legislation: legislationMetadataSchema.optional(),
    /** Obligatorio cuando documentType es "administrative_circular" (ver superRefine). */
    administrativeCircular: administrativeCircularMetadataSchema.optional(),
    /** Obligatorio cuando documentType es "shab_entry" (ver superRefine). */
    shabPublication: shabPublicationMetadataSchema.optional(),

    provenance: provenanceSchema,
    rawMetadata: z.record(z.string(), z.unknown()).default({}),
    contentNature: contentNatureSchema,
  })
  .superRefine((value, ctx) => {
    if (value.fullText !== undefined && value.contentNature !== "literal") {
      ctx.addIssue({
        code: "custom",
        path: ["contentNature"],
        message: "Si fullText esta presente, contentNature debe ser 'literal'.",
      });
    }
    if (
      value.provenance.officialCharacter === "unofficial_aggregator" &&
      !value.provenance.aggregatorName
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["provenance", "aggregatorName"],
        message: "Una fuente 'unofficial_aggregator' debe declarar aggregatorName.",
      });
    }
    if (
      value.provenance.officialCharacter === "unofficial_aggregator" &&
      !value.provenance.aggregatorUrl
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["provenance", "aggregatorUrl"],
        message: "Una fuente 'unofficial_aggregator' debe declarar aggregatorUrl.",
      });
    }
    const isLegislationType =
      value.documentType === "legislation_law" || value.documentType === "legislation_article";
    if (isLegislationType && !value.legislation) {
      ctx.addIssue({
        code: "custom",
        path: ["legislation"],
        message:
          "documentType legislation_law/legislation_article requiere el bloque 'legislation'.",
      });
    }
    if (!isLegislationType && value.legislation) {
      ctx.addIssue({
        code: "custom",
        path: ["legislation"],
        message:
          "El bloque 'legislation' solo aplica a documentType legislation_law/legislation_article.",
      });
    }
    if (
      value.documentType === "legislation_article" &&
      value.legislation &&
      !value.legislation.articleLocation
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["legislation", "articleLocation"],
        message: "documentType legislation_article requiere legislation.articleLocation.",
      });
    }
    if (
      value.documentType === "legislation_law" &&
      value.legislation?.articleLocation !== undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["legislation", "articleLocation"],
        message:
          "documentType legislation_law no debe declarar articleLocation (eso es un articulo, no la ley completa).",
      });
    }
    const isAdministrativeCircularType = value.documentType === "administrative_circular";
    if (isAdministrativeCircularType && !value.administrativeCircular) {
      ctx.addIssue({
        code: "custom",
        path: ["administrativeCircular"],
        message:
          "documentType administrative_circular requiere el bloque 'administrativeCircular'.",
      });
    }
    if (!isAdministrativeCircularType && value.administrativeCircular) {
      ctx.addIssue({
        code: "custom",
        path: ["administrativeCircular"],
        message:
          "El bloque 'administrativeCircular' solo aplica a documentType administrative_circular.",
      });
    }
    const isShabEntryType = value.documentType === "shab_entry";
    if (isShabEntryType && !value.shabPublication) {
      ctx.addIssue({
        code: "custom",
        path: ["shabPublication"],
        message: "documentType shab_entry requiere el bloque 'shabPublication'.",
      });
    }
    if (!isShabEntryType && value.shabPublication) {
      ctx.addIssue({
        code: "custom",
        path: ["shabPublication"],
        message: "El bloque 'shabPublication' solo aplica a documentType shab_entry.",
      });
    }
  });

export type NormalizedDocument = z.infer<typeof normalizedDocumentSchema>;

export function parseNormalizedDocument(raw: unknown): NormalizedDocument {
  return normalizedDocumentSchema.parse(raw);
}
