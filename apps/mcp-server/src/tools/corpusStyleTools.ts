import { z } from "zod";
import type { ToolRegistry } from "@swiss-legal-mcp/core";
import { analyzeCorpusStyle, type CorpusDocument } from "./corpusStyleAnalysis.js";
import { discoverFederalCaseCandidates } from "./officialFederalCaseSearch.js";
import { resolveOfficialSwissCase } from "./officialSwissCaseResolver.js";

const MAX_DOCUMENTS = 80;

/**
 * analyze_case_corpus_style: calcula en el servidor que frases se repiten en un corpus de
 * sentencias del Tribunal Federal y en cuantas aparece cada una. Sustituye a leer decenas de
 * sentencias una a una y contar a ojo (un modelo solo llego a cuantificar 3 formulas de 47
 * sentencias y agoto su limite de llamadas). Cada sentencia se lee del portal oficial con
 * identidad y texto integro verificados; el resto se calcula localmente y es reproducible.
 */
export function registerCorpusStyleTools(tools: ToolRegistry): void {
  tools.register({
    name: "analyze_case_corpus_style",
    description:
      "Analiza el estilo de redaccion de un corpus de sentencias del Tribunal Federal (texto oficial verificado) y devuelve, calculado en el servidor: marcadores de estructura, formulas del dispositivo, formulas de resultado (desestimacion, estimacion, no entrada en materia...) y las FRASES COMPLETAS que mas se repiten, cada una con en cuantas sentencias aparece y ejemplos con su numero de expediente. Pase `case_references` (numeros de expediente, p. ej. los de export_case_corpus) o `query` (+ `chamber`) para descubrirlos. Las sentencias no indican quien redacta: el estilo es de la sala, no de un juez.",
    inputSchema: {
      case_references: z.array(z.string().min(3).max(60)).max(MAX_DOCUMENTS).optional(),
      query: z.string().min(2).max(200).optional(),
      chamber: z
        .enum([
          "I_public_law",
          "II_public_law",
          "I_civil_law",
          "II_civil_law",
          "criminal_law",
          "I_social_law",
          "II_social_law",
        ])
        .optional(),
      language: z.enum(["de", "fr", "it"]).default("de"),
      target_size: z.number().int().min(2).max(MAX_DOCUMENTS).default(40),
      top_n: z.number().int().min(1).max(100).default(30),
      min_share: z.number().min(0.05).max(1).default(0.25),
      time_budget_seconds: z.number().int().min(10).max(150).default(75),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => {
      let references = [...new Set(input.case_references ?? [])];
      const warnings: string[] = [];
      if (references.length === 0) {
        if (!input.query) {
          return {
            error:
              "Indique `case_references` (numeros de expediente) o `query` para descubrir sentencias.",
          };
        }
        const discovered = await discoverFederalCaseCandidates({
          query: input.query,
          language: input.language,
          max_results: input.target_size * 3,
          ...(input.chamber ? { chamber: input.chamber } : {}),
        });
        references = [
          ...new Set(
            discovered.results
              .map((item) => item.case_number)
              .filter((n): n is string => typeof n === "string"),
          ),
        ].slice(0, input.target_size);
        warnings.push(...discovered.warnings.filter((w) => !/total_discovered/.test(w)));
      }

      const documents: CorpusDocument[] = [];
      const skipped: { case_number: string; reason: string }[] = [];
      const partialExtraction: string[] = [];
      const startedAt = Date.now();
      const remaining: string[] = [];
      // De una en una: respeta el ritmo con el portal y la cache en disco evita repetir peticiones.
      for (const reference of references.slice(0, MAX_DOCUMENTS)) {
        // Presupuesto de tiempo: el portal se consulta a ritmo educado (las sentencias nuevas
        // tardan segundos cada una), asi que una llamada se corta y devuelve lo obtenido; lo ya
        // descargado esta en la cache en disco y la siguiente llamada continua sin repetirlo.
        if (Date.now() - startedAt > input.time_budget_seconds * 1000) {
          remaining.push(reference);
          continue;
        }
        try {
          const resolved = await resolveOfficialSwissCase({
            case_reference: reference,
            require_official_source: true,
            require_full_text: true,
            retrieval_mode: "full_text",
          });
          const text = resolved.fetch?.text;
          // Para analizar estilo basta el texto oficial con identidad verificada: las decisiones
          // breves (presidente, juez unico) quedaban fuera por "extraction_incomplete" (secciones
          // sin separar) aunque el texto estaba completo. Se incluyen y se marcan aparte.
          const identityVerified = resolved.identity?.status === "identity_verified";
          const fetched = resolved.fetch?.fetch_status === "fetch_success";
          if (!text || !identityVerified || !fetched) {
            skipped.push({
              case_number: reference,
              reason: `sin texto oficial con identidad verificada (lectura: ${resolved.legal_use?.reading_status ?? "desconocida"})`,
            });
            continue;
          }
          if (resolved.legal_use?.reading_status !== "full_text_verified_official") {
            partialExtraction.push(reference);
          }
          documents.push({ caseNumber: reference, text });
        } catch (error) {
          skipped.push({
            case_number: reference,
            reason: error instanceof Error ? error.message.slice(0, 160) : String(error),
          });
          // Si el portal esta en pausa por un reto antibots, no se sigue intentando.
          if (error instanceof Error && /bger_cooldown_active/.test(error.message)) {
            warnings.push(
              "El acceso al portal esta en pausa tras un reto antibots; se devuelve el analisis con las sentencias ya obtenidas.",
            );
            break;
          }
        }
      }

      if (documents.length < 2) {
        return {
          documents_analyzed: documents.length,
          skipped,
          warnings,
          error:
            "Se necesitan al menos 2 sentencias con texto oficial verificado para analizar el estilo.",
        };
      }
      const report = analyzeCorpusStyle(documents, {
        minShare: input.min_share,
        topN: input.top_n,
      });
      return {
        ...report,
        cases: documents.map((doc) => doc.caseNumber),
        included_with_partial_section_extraction: partialExtraction,
        remaining_case_numbers: remaining,
        ...(remaining.length > 0
          ? {
              continue_hint: `Quedan ${remaining.length} sentencia(s) por descargar (limite de tiempo por llamada). Vuelva a llamar con los mismos argumentos (o con case_references = cases + remaining_case_numbers) para analizar el conjunto completo: lo ya descargado esta en cache y no se vuelve a pedir.`,
            }
          : {}),
        skipped,
        warnings,
      };
    },
  });
}
