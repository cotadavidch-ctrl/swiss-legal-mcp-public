import { z } from "zod";
import type { ToolContext, ToolRegistry } from "@swiss-legal-mcp/core";
import { checkNorm, type NormCheck } from "./decisionReviewTools.js";
import { resolveOfficialSwissCase } from "./officialSwissCaseResolver.js";
import {
  prepareCouncil,
  validateCouncil,
  VOICE_IDS,
  type CouncilFact,
  type CouncilToValidate,
  type NormVerdict,
} from "./legalCouncil.js";

const factSchema = z
  .object({
    id: z.string().min(1).max(40),
    description: z.string().min(2).max(1500),
    status: z.enum(["accepted", "alleged", "disputed", "unknown"]),
    source: z.string().max(300).optional(),
  })
  .strict();

const sideSchema = z.enum([
  "claimant",
  "defendant",
  "appellant",
  "respondent",
  "authority",
  "insured",
  "insurer",
  "taxpayer",
  "tax_authority",
  "other",
]);

const argumentSchema = z
  .object({
    claim: z.string().min(3).max(1200),
    norms: z.array(z.string().min(3).max(120)).max(10).default([]),
    authorities: z.array(z.string().min(3).max(120)).max(10).default([]),
    facts_used: z.array(z.string().min(1).max(40)).max(20).default([]),
    conditional: z.boolean().default(false),
  })
  .strict();

const voiceSchema = z
  .object({
    voice_id: z.enum(VOICE_IDS),
    position: z.string().min(3).max(3000),
    outcome_leaning: z.enum(["favorable_to_me", "unfavorable_to_me", "mixed"]),
    confidence: z.enum(["low", "medium", "high"]),
    arguments: z.array(argumentSchema).max(12).default([]),
    risks: z.array(z.string().min(2).max(500)).max(12).default([]),
  })
  .strict();

/**
 * Una sentencia que el portal no encuentra es "not_found"; una que no se pudo comprobar es
 * "unavailable". Solo se afirma que no existe cuando el portal respondio con su pagina de
 * busqueda sin ningun enlace que coincida y no hay senales de bloqueo, pausa o error de red.
 */
export function authorityVerdictFromWarnings(warnings: readonly string[]): NormVerdict {
  if (warnings.includes("source_not_found")) return "not_found";
  const portalAnswered =
    warnings.includes("no_exact_official_document_link_found") &&
    warnings.includes("redirect_to_search_page");
  const blockedOrFailed = warnings.some((warning) =>
    /challenge|cooldown|blocked|bot|timeout|timed_out|rate|network|aborted|http_/i.test(warning),
  );
  return portalAnswered && !blockedOrFailed ? "not_found" : "unavailable";
}

function verdictOf(check: NormCheck): NormVerdict {
  if (check.status === "verified_exists") return "verified";
  if (check.status === "not_found" && check.scope !== "cantonal") return "not_found";
  return "unavailable";
}

/**
 * Consejo juridico de estrategia como herramienta del servidor. El servidor no razona como un
 * juez: prepara el encargo de cada voz con material ya verificado y, despues, valida las posiciones
 * que escribe el modelo (normas, hechos, mezcla de papeles, certeza, contraargumento).
 */
export function registerLegalCouncilTools(tools: ToolRegistry): void {
  tools.register({
    name: "prepare_legal_council",
    description:
      "Prepara un CONSEJO JURIDICO DE ESTRATEGIA para el caso del usuario: entrega el encargo de cada voz (mi abogado, abogado contrario, juez favorable, juez estricto, juez neutral), el material juridico YA verificado que aplica (via procesal, plazos de regla conocida, fundamentos), los datos que faltan y la plantilla de sintesis. Despues cada voz escribe su posicion (el modelo) y se valida con validate_legal_council. Los jueces y el abogado contrario son perspectivas simuladas, no predicciones.",
    inputSchema: {
      side: sideSchema,
      side_label: z.string().min(2).max(120).optional(),
      matter: z.object({
        area: z.enum([
          "civil",
          "criminal",
          "administrative",
          "social-insurance",
          "tax",
          "employment",
          "tenancy",
          "debt-enforcement",
          "constitutional",
          "other",
        ]),
        subarea: z.string().min(1).max(200).optional(),
        description: z.string().min(5).max(4000),
      }),
      canton: z.string().length(2).optional(),
      stage: z.string().min(2).max(200).optional(),
      facts: z.array(factSchema).max(60).default([]),
      objectives: z.array(z.string().min(2).max(500)).max(10).default([]),
      my_arguments: z.array(z.string().min(2).max(800)).max(15).default([]),
      known_opposing_arguments: z.array(z.string().min(2).max(800)).max(15).default([]),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) =>
      prepareCouncil({
        side: input.side,
        sideLabel: input.side_label,
        matter: input.matter,
        canton: input.canton,
        stage: input.stage,
        facts: input.facts,
        objectives: input.objectives,
        myArguments: input.my_arguments,
        knownOpposingArguments: input.known_opposing_arguments,
      }),
  });

  tools.register({
    name: "validate_legal_council",
    description:
      "Valida un consejo juridico de estrategia ya escrito (las cinco voces, la revision cruzada y la sintesis): comprueba cada norma citada contra la fuente oficial, que los hechos usados consten en el caso, mezcla de papeles (juez que habla como abogado, abogado que pronuncia fallo), lenguaje de certeza, confianza alta sin soporte, jueces no diferenciados y sintesis que oculta el mejor argumento en contra. Devuelve la matriz de acuerdos y discrepancias. No valora si la estrategia es juridicamente acertada.",
    inputSchema: {
      facts: z.array(factSchema).max(60).default([]),
      canton: z.string().length(2).optional(),
      voices: z.array(voiceSchema).min(1).max(8),
      cross_review: z
        .array(
          z.object({
            reviewer: z.string().min(1).max(60),
            target: z.string().min(1).max(60),
            weakest_point: z.string().min(3).max(800),
          }),
        )
        .max(30)
        .default([]),
      synthesis: z
        .object({
          recommendation: z.string().min(3).max(3000).optional(),
          strongest_argument_against: z.string().min(3).max(2000).optional(),
          missing_data_that_changes_recommendation: z
            .array(z.string().min(2).max(500))
            .max(15)
            .optional(),
          unverified_parts: z.array(z.string().min(2).max(500)).max(20).optional(),
        })
        .optional(),
      verify_norms: z.boolean().default(true),
      verify_authorities: z.boolean().default(true),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) => {
      const council: CouncilToValidate = {
        voices: input.voices.map((voice) => ({
          voiceId: voice.voice_id,
          position: voice.position,
          outcomeLeaning: voice.outcome_leaning,
          confidence: voice.confidence,
          risks: voice.risks,
          arguments: voice.arguments.map((a) => ({
            claim: a.claim,
            norms: a.norms,
            authorities: a.authorities,
            factsUsed: a.facts_used,
            conditional: a.conditional,
          })),
        })),
        crossReview: input.cross_review.map((c) => ({
          reviewer: c.reviewer,
          target: c.target,
          weakestPoint: c.weakest_point,
        })),
        synthesis: input.synthesis
          ? {
              recommendation: input.synthesis.recommendation,
              strongestArgumentAgainst: input.synthesis.strongest_argument_against,
              missingDataThatChangesRecommendation:
                input.synthesis.missing_data_that_changes_recommendation,
              unverifiedParts: input.synthesis.unverified_parts,
            }
          : undefined,
      };
      const cache = new Map<string, NormCheck>();
      const facts: CouncilFact[] = input.facts;
      return validateCouncil(
        council,
        facts,
        async (citation) => {
          if (!input.verify_norms) return "unavailable";
          const check = await checkNorm(citation, cache, context, { canton: input.canton });
          return verdictOf(check);
        },
        async (reference) => {
          if (!input.verify_authorities) return "unavailable";
          try {
            // De una en una y con la cache en disco: las sentencias ya leidas no vuelven a pedirse.
            const resolved = await resolveOfficialSwissCase({
              case_reference: reference,
              require_official_source: true,
              require_full_text: false,
              retrieval_mode: "full_text",
            });
            if (resolved.identity?.status === "identity_verified") return "verified";
            return authorityVerdictFromWarnings(resolved.fetch?.warnings ?? []);
          } catch {
            return "unavailable";
          }
        },
      );
    },
  });
}
