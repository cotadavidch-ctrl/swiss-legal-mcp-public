import { z } from "zod";
import { provenanceRefSchema, type ProvenanceRef } from "@swiss-legal-mcp/core";

const idSchema = z.string().min(1);
const provenanceSchema = z.array(provenanceRefSchema).min(1);

export const legalLanguageSchema = z.enum(["DE", "FR", "IT", "ES"]);
export type LegalLanguage = z.infer<typeof legalLanguageSchema>;

export const translationStatusSchema = z.enum([
  "ORIGINAL",
  "HUMAN_TRANSLATED",
  "MACHINE_TRANSLATED",
  "MACHINE_TRANSLATED_REVIEWED",
  "UNVERIFIED_TRANSLATION",
]);
export type TranslationStatus = z.infer<typeof translationStatusSchema>;

export const canonicalLegalConceptSchema = z.enum([
  "ADMINISTRATIVE_DECISION",
  "ADMINISTRATIVE_APPEAL",
  "JUDICIAL_COMPLAINT",
  "RIGHT_TO_BE_HEARD",
  "FILE_ACCESS",
  "REMAND",
  "EVENTUAL_REQUEST",
  "INTERIM_RELIEF",
  "LEGAL_AID",
  "COSTS",
]);
export type CanonicalLegalConcept = z.infer<typeof canonicalLegalConceptSchema>;

export const translatedLegalPassageSchema = z.object({
  passage_id: idSchema,
  original_text: z.string().min(1),
  original_language: legalLanguageSchema,
  translated_text: z.string().min(1).optional(),
  target_language: legalLanguageSchema.optional(),
  translation_status: translationStatusSchema,
  translator_type: z.enum(["NONE", "HUMAN", "MACHINE", "MACHINE_WITH_HUMAN_REVIEW"]),
  official_wording: z.boolean(),
  provenance: provenanceSchema,
});
export type TranslatedLegalPassage = z.infer<typeof translatedLegalPassageSchema>;

export const legalTermEntrySchema = z.object({
  concept: canonicalLegalConceptSchema,
  expressions: z.object({
    DE: z.array(z.string().min(1)).default([]),
    FR: z.array(z.string().min(1)).default([]),
    IT: z.array(z.string().min(1)).default([]),
    ES: z.array(z.string().min(1)).default([]),
  }),
  distinction_note: z.string().min(1),
});
export type LegalTermEntry = z.infer<typeof legalTermEntrySchema>;

export const crossLanguageQueryExpansionSchema = z.object({
  concept: canonicalLegalConceptSchema,
  source_language: legalLanguageSchema,
  target_languages: z.array(legalLanguageSchema),
  terms: z.array(
    z.object({
      language: legalLanguageSchema,
      term: z.string().min(1),
      translation_status: z.literal("UNVERIFIED_TRANSLATION"),
    }),
  ),
  warning: z.string().min(1),
  provenance: provenanceSchema,
});
export type CrossLanguageQueryExpansion = z.infer<typeof crossLanguageQueryExpansionSchema>;

export const draftingStyleProfileSchema = z.object({
  language: legalLanguageSchema,
  audience: z.enum(["COURT", "ADMINISTRATIVE_AUTHORITY", "OPPOSING_COUNSEL", "CLIENT"]),
  style: z.string().min(1),
  avoid: z.array(z.string().min(1)),
});
export type DraftingStyleProfile = z.infer<typeof draftingStyleProfileSchema>;

export const swissLegalTerminology: LegalTermEntry[] = [
  {
    concept: "ADMINISTRATIVE_DECISION",
    expressions: {
      DE: ["Verfügung"],
      FR: ["décision"],
      IT: ["decisione"],
      ES: ["decisión administrativa"],
    },
    distinction_note:
      "Administrative decision terms are procedural acts, not generic communications.",
  },
  {
    concept: "ADMINISTRATIVE_APPEAL",
    expressions: {
      DE: ["Rekurs", "Beschwerde"],
      FR: ["recours"],
      IT: ["ricorso"],
      ES: ["recurso"],
    },
    distinction_note:
      "Rekurs and Beschwerde may be distinct under local procedural law and must not be flattened.",
  },
  {
    concept: "RIGHT_TO_BE_HEARD",
    expressions: {
      DE: ["rechtliches Gehör"],
      FR: ["droit d'être entendu"],
      IT: ["diritto di essere sentito"],
      ES: ["derecho a ser oído"],
    },
    distinction_note:
      "The canonical concept preserves the Swiss procedural right while retaining language-specific wording.",
  },
  {
    concept: "FILE_ACCESS",
    expressions: {
      DE: ["Akteneinsicht"],
      FR: ["consultation du dossier"],
      IT: ["accesso agli atti"],
      ES: ["acceso al expediente"],
    },
    distinction_note:
      "File access is a procedural right/request, not the same as production of new evidence.",
  },
  {
    concept: "REMAND",
    expressions: {
      DE: ["Rückweisung"],
      FR: ["renvoi"],
      IT: ["rinvio"],
      ES: ["devolución para nueva decisión"],
    },
    distinction_note:
      "Remand language must preserve the procedural consequence and competent authority.",
  },
  {
    concept: "EVENTUAL_REQUEST",
    expressions: {
      DE: ["Eventualbegehren"],
      FR: ["conclusion subsidiaire"],
      IT: ["conclusione subordinata"],
      ES: ["pretensión subsidiaria"],
    },
    distinction_note: "Eventual relief is conditional fallback relief, not a second primary claim.",
  },
];

export function preserveOriginalQuote(input: {
  passage_id: string;
  original_text: string;
  original_language: LegalLanguage;
  translated_text?: string;
  target_language?: LegalLanguage;
  translation_status: TranslationStatus;
  translator_type: TranslatedLegalPassage["translator_type"];
  provenance: ProvenanceRef[];
}): TranslatedLegalPassage {
  return translatedLegalPassageSchema.parse({
    ...input,
    official_wording: input.translation_status === "ORIGINAL",
  });
}

export function expandLegalQuery(input: {
  concept: CanonicalLegalConcept;
  source_language: LegalLanguage;
  target_languages: LegalLanguage[];
  provenance: ProvenanceRef[];
}): CrossLanguageQueryExpansion {
  const entry = swissLegalTerminology.find((item) => item.concept === input.concept);
  const terms =
    entry === undefined
      ? []
      : input.target_languages.flatMap((language) =>
          entry.expressions[language].map((term) => ({
            language,
            term,
            translation_status: "UNVERIFIED_TRANSLATION" as const,
          })),
        );
  return crossLanguageQueryExpansionSchema.parse({
    concept: input.concept,
    source_language: input.source_language,
    target_languages: input.target_languages,
    terms,
    warning:
      "Cross-language terms support discovery only and do not claim perfect semantic equivalence.",
    provenance: input.provenance,
  });
}

export function renderLanguageAwareStyleInstruction(input: {
  language: LegalLanguage;
  audience: DraftingStyleProfile["audience"];
}): DraftingStyleProfile {
  const style: Record<LegalLanguage, string> = {
    DE: "Swiss German legal style: precise, restrained, issue-first, with calibrated evidentiary wording.",
    FR: "Swiss French legal style: structured, formal, restrained, with clear conclusions and source limits.",
    IT: "Swiss Italian legal style: formal, concise, institutionally respectful, with explicit procedural framing.",
    ES: "Spanish working explanation: clear and faithful to source language; not an official legal translation.",
  };
  return draftingStyleProfileSchema.parse({
    language: input.language,
    audience: input.audience,
    style: style[input.language],
    avoid: [
      "accusatory language",
      "unsupported certainty",
      "machine translation as official wording",
    ],
  });
}
