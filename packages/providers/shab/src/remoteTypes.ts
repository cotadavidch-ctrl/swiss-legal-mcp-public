import { z } from "zod";

/**
 * Forma real de la API de SHAB/Amtsblattportal (`GET /api/v1/publications`),
 * verificada en vivo en Fase 5 por inspeccion de red (ver
 * docs/provider-contracts/shab.md y tests/fixtures/shab/). Documentada y
 * probada aunque `ShabProvider` nunca la invoque en produccion (bloqueado
 * por `robots.txt`, ver ADR correspondiente) -- lista para si en el futuro
 * aparece un canal de acceso autorizado.
 */

const shabTitleSchema = z.object({
  de: z.string().min(1),
  en: z.string().min(1).optional(),
  it: z.string().min(1).optional(),
  fr: z.string().min(1).optional(),
});

const shabRegistrationOfficeRemoteSchema = z.object({
  id: z.string().min(1).optional(),
  displayName: z.string().min(1),
  uid: z.string().min(1).nullable().optional(),
});

const shabPersonSchema = z.object({
  prename: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  dateOfBirth: z.string().min(1).optional(),
  dateOfDeath: z.string().min(1).nullable().optional(),
});

const shabCompanySchema = z.object({
  name: z.string().min(1).optional(),
  uidOrganisationId: z.string().min(1).nullable().optional(),
});

const shabDebtorSchema = z
  .object({
    selectType: z.enum(["person", "company"]).optional(),
    person: shabPersonSchema.optional(),
    companies: z.object({ company: shabCompanySchema.optional() }).optional(),
  })
  .optional();

export const shabRemoteMetaSchema = z.object({
  id: z.string().min(1),
  publicationNumber: z.string().min(1),
  rubric: z.string().min(1),
  subRubric: z.string().min(1).optional(),
  language: z.enum(["de", "fr", "it"]),
  publicationState: z.enum(["PUBLISHED", "CANCELLED"]),
  publicationDate: z.string().min(1),
  expirationDate: z.string().min(1).nullable().optional(),
  registrationOffice: shabRegistrationOfficeRemoteSchema.optional(),
  legalRemedy: z.string().min(1).nullable().optional(),
  cantons: z.array(z.string().length(2)).optional(),
  title: shabTitleSchema,
  dossierReference: z.string().min(1).nullable().optional(),
  repeatedPublications: z.array(z.string().min(1)).nullable().optional(),
});
export type ShabRemoteMeta = z.infer<typeof shabRemoteMetaSchema>;

export const shabRemotePublicationSchema = z.object({
  meta: shabRemoteMetaSchema,
  content: z
    .object({
      debtor: shabDebtorSchema,
    })
    .passthrough()
    .nullable()
    .optional(),
});
export type ShabRemotePublication = z.infer<typeof shabRemotePublicationSchema>;

export const shabRemoteListResponseSchema = z.object({
  content: z.array(shabRemotePublicationSchema),
  total: z.number().int().nonnegative(),
});
export type ShabRemoteListResponse = z.infer<typeof shabRemoteListResponseSchema>;
