import { z } from "zod";
import type { ToolContext, ToolRegistry } from "@swiss-legal-mcp/core";
import {
  analyzeSubmissions,
  composeBriefSkeleton,
  draftMisquote,
  draftNormContent,
  extractNumbers,
  officialExcerpt,
  segmentDocument,
  type Finding,
} from "./opposingSubmissionAnalyzer.js";
import { ARTICLE_RE, extractQuotesFromDraft, lawSourceForAbbreviation } from "./quoteVerifier.js";
import { loadSourceText, runQuoteVerification } from "./quoteTools.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD");

const documentSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(80).optional(),
  author: z.enum(["opposing_party", "own_party"]),
  date: isoDate.optional(),
  text: z.string().min(20).max(200_000),
});
const recordFactSchema = z.object({
  id: z.string().min(1).max(40),
  statement: z.string().min(10).max(2000),
  source: z.string().min(1).max(200).optional(),
});

const MAX_DOCUMENTS = 12;
const LIMITATIONS = [
  "Análisis heurístico (raíces de palabras, cifras, fechas, negaciones y patrones DE/FR): detecta CANDIDATAS, no decide si hay contradicción jurídica.",
  "Solo ve contradicciones expresadas con palabras parecidas; no entiende paráfrasis ni razonamientos largos.",
  "Cada hallazgo trae la cita literal y su ubicación: valídela en el original antes de usarla.",
  "Los borradores son un punto de partida para un profesional; los corchetes [PRÜFEN...] indican lo que debe comprobar una persona.",
  "Las normas de apoyo se limitan a ZGB 2, ZPO 52/55/150, BV 5/9, StPO 3/6, VwVG 12 y ATSG 43 (texto leído en Fedlex el 2026-11-12).",
];

export function registerOpposingSubmissionTools(tools: ToolRegistry): void {
  tools.register({
    name: "analyze_opposing_submission",
    description:
      "Prepara la RÉPLICA a partir del escrito de la parte contraria: localiza sus admisiones (Zugeständnisse), sus contradicciones (dentro de un escrito, entre escritos y frente a hechos del expediente), sus afirmaciones sin medio de prueba o absolutas, y comprueba si las citas entrecomilladas de ley y jurisprudencia son literales (verify_quoted_passages). Devuelve cada hallazgo con la frase LITERAL y su ubicación (Rz./párrafo), preguntas de control y un borrador de réplica en alemán o francés que devuelve a la contraparte sus propias frases, con apoyo en ZGB 2, ZPO 52/55/150, BV 5/9, StPO 3/6, VwVG 12, ATSG 43. Distingue lo que NO es una admisión (argumento eventual, atribución a la otra parte, matiz 'zwar... aber'). Analiza también el escrito PROPIO (author='own_party') para avisar de lo que la contraparte podría devolvernos; sin escrito contrario revisa solo el propio antes de presentarlo. Heurístico: son candidatas que debe validar un profesional.",
    inputSchema: {
      documents: z.array(documentSchema).min(1).max(MAX_DOCUMENTS),
      recordFacts: z.array(recordFactSchema).max(200).optional(),
      procedureFamily: z
        .enum(["zpo", "stpo", "administrative", "social_insurance", "other"])
        .default("zpo"),
      outputLanguage: z.enum(["de", "fr", "it"]).default("de"),
      verifyAuthorities: z.boolean().default(true),
      maxFindings: z.number().int().min(1).max(100).default(40),
      composeBrief: z.boolean().default(true),
      includeLowStrength: z.boolean().default(false),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) => {
      const ids = new Set<string>();
      for (const d of input.documents) {
        if (ids.has(d.id)) {
          return {
            status: "invalid_input" as const,
            warnings: [`Id de documento repetido: '${d.id}'.`],
          };
        }
        ids.add(d.id);
      }
      const hasOpposing = input.documents.some((d) => d.author === "opposing_party");

      const family = input.procedureFamily;
      const lang = input.outputLanguage;
      const analysis = analyzeSubmissions({
        documents: input.documents,
        recordFacts: input.recordFacts,
        procedureFamily: family,
        outputLanguage: input.outputLanguage,
        maxFindings: input.maxFindings,
      });

      const warnings = [...analysis.warnings];
      if (!hasOpposing) {
        warnings.push(
          "Sin escrito contrario: se analiza solo el riesgo de SU PROPIO escrito (campo 'exposure'). Añada un documento con author='opposing_party' para el análisis completo.",
        );
      }
      const authorityChecks: {
        document: string;
        location: string;
        citation: string | null;
        status: string;
      }[] = [];
      const misquotes: Finding[] = [];

      if (input.verifyAuthorities) {
        for (const doc of input.documents.filter((d) => d.author === "opposing_party")) {
          const label = doc.label ?? doc.id;
          const extracted = extractQuotesFromDraft(doc.text);
          if (extracted.length === 0) continue;
          const segments = segmentDocument(
            { id: doc.id, label, author: doc.author, text: doc.text },
            0,
          );
          const locate = (offset: number): string =>
            segments.find((x) => offset >= x.offset && offset < x.offset + x.text.length)
              ?.location ?? `${label}, posición ${offset}`;
          let verified;
          try {
            verified = await runQuoteVerification({ draft: doc.text }, context);
          } catch (error) {
            warnings.push(
              `No se pudieron verificar las citas de '${label}': ${error instanceof Error ? error.message : String(error)}`,
            );
            continue;
          }
          if (!("results" in verified)) {
            warnings.push(
              `Citas de '${label}' no verificadas: ${(verified as { warnings?: string[] }).warnings?.join(" ") ?? "entrada no válida"}`,
            );
            continue;
          }
          const results = verified.results as readonly {
            index: number;
            status: string;
            verification: { closestPassage: string | null } | null;
          }[];
          for (const r of results) {
            const e = extracted[r.index];
            if (!e) continue;
            const location = locate(e.offset);
            authorityChecks.push({
              document: label,
              location,
              citation: e.citation?.raw ?? null,
              status: r.status,
            });
            if ((r.status === "near_match_altered" || r.status === "not_found") && e.citation) {
              misquotes.push({
                id: `MIS-${misquotes.length + 1}`,
                type: "misquoted_authority",
                strength: r.status === "near_match_altered" ? "high" : "medium",
                passages: [
                  { docId: doc.id, docLabel: label, location, offset: e.offset, text: e.quote },
                ],
                why:
                  r.status === "near_match_altered"
                    ? "La cita entrecomillada se parece al texto oficial pero NO es literal (palabras cambiadas)."
                    : "La cita entrecomillada no aparece en el texto oficial de la fuente indicada.",
                legalAnchors: [],
                reviewQuestions: [
                  "¿Cita una versión anterior de la norma (fecha relevante)?",
                  "¿La cita proviene de una traducción o de un comentario y no del texto oficial?",
                  "¿El cambio de palabras altera el sentido jurídico?",
                ],
                caveats:
                  r.status === "not_found"
                    ? [
                        "Puede deberse a una referencia asociada por cercanía: confirme que la cita corresponde a esa norma.",
                      ]
                    : [],
                draftRebuttal: draftMisquote(
                  location,
                  e.citation.raw,
                  e.quote,
                  officialExcerpt(r.verification?.closestPassage ?? null, e.quote),
                  lang === "it" ? "de" : lang,
                ),
              });
            }
          }
        }
      }

      // --- Numeros de una norma parafraseada (plazos, porcentajes) frente al texto oficial ---
      const normFindings: Finding[] = [];
      if (input.verifyAuthorities) {
        const cache = new Map<string, string | null>();
        const UNITS = ["days", "weeks", "months", "years", "percent", "hours"] as const;
        let checked = 0;
        for (const doc of input.documents.filter((d) => d.author === "opposing_party")) {
          const label = doc.label ?? doc.id;
          for (const seg of segmentDocument(
            { id: doc.id, label, author: doc.author, text: doc.text },
            0,
          )) {
            if (checked >= 20) break;
            if (/[«“„"][^«»“”„"\n]{30,}[»”“"]/.test(seg.text)) continue; // citas literales: ya verificadas
            const cites = [...seg.text.matchAll(new RegExp(ARTICLE_RE.source, "g"))];
            if (new Set(cites.map((c) => `${c[2]}|${c[1]}`)).size !== 1) continue;
            const claimed = extractNumbers(seg.text);
            if (claimed.has("date") || claimed.has("amount")) continue; // dato del caso, no contenido de la norma
            const kinds = UNITS.filter((u) => claimed.has(u));
            if (kinds.length === 0) continue;
            const article = cites[0]![1]!;
            const abbreviation = cites[0]![2]!;
            const law = lawSourceForAbbreviation(abbreviation);
            if (!law) continue;
            const key = `${abbreviation}|${article}`;
            if (!cache.has(key)) {
              const loaded = await loadSourceText(
                {
                  type: "article",
                  ...(law.eli ? { eli: law.eli } : {}),
                  ...(law.systematicNumber ? { systematicNumber: law.systematicNumber } : {}),
                  articleNumber: article,
                  language: law.language,
                },
                context,
              );
              cache.set(key, loaded.ok ? loaded.text : null);
            }
            const articleText = cache.get(key);
            if (!articleText) continue;
            checked += 1;
            const official = extractNumbers(articleText);
            for (const kind of kinds) {
              const officialValues = official.get(kind);
              const theirValues = claimed.get(kind)!;
              if (!officialValues || [...theirValues].some((v) => officialValues.has(v))) continue;
              normFindings.push({
                id: `NRM-${normFindings.length + 1}`,
                type: "misstated_norm_content",
                strength: "medium",
                passages: [
                  {
                    docId: doc.id,
                    docLabel: label,
                    location: seg.location,
                    offset: seg.offset,
                    text: seg.text,
                  },
                ],
                why: `La frase cita ${cites[0]![0]} y da ${[...theirValues].join("/")} (${kind}), pero el artículo oficial solo usa ${[...officialValues].join("/")} para esa magnitud.`,
                legalAnchors: [],
                reviewQuestions: [
                  "¿El número se refiere realmente a lo que establece el artículo, o es un hecho del caso (p. ej. días transcurridos)?",
                  "¿Cita una versión anterior de la norma o una norma remitida?",
                  "¿Qué apartado (Abs.) del artículo contiene la cifra correcta?",
                ],
                caveats: [
                  "Comparación numérica con el texto del artículo: la cifra de la frase puede ser un dato del caso y no el contenido de la norma. Léala en su contexto.",
                ],
                draftRebuttal: draftNormContent(
                  seg.location,
                  cites[0]![0],
                  seg.text,
                  kind,
                  [...theirValues],
                  [...officialValues],
                  lang === "it" ? "de" : lang,
                ),
              });
              break;
            }
          }
        }
      }

      const findings = [...misquotes, ...normFindings, ...analysis.findings];
      const brief =
        input.composeBrief && hasOpposing
          ? composeBriefSkeleton(findings, lang, input.includeLowStrength)
          : null;
      const count = (type: Finding["type"]): number =>
        findings.filter((f) => f.type === type).length;
      return {
        status: "analyzed" as const,
        method: "deterministic_heuristics_v1",
        mode: hasOpposing ? ("opposing_analysis" as const) : ("own_submission_review" as const),
        procedureFamily: family,
        outputLanguage: lang,
        summary: {
          statementsAnalyzed: analysis.statements,
          admissions: findings.filter((f) => f.type === "admission" && f.strength !== "low").length,
          admissionCandidatesLowConfidence: findings.filter(
            (f) => f.type === "admission" && f.strength === "low",
          ).length,
          unansweredAllegations: count("unanswered_allegation"),
          contradictionsWithinDocument: count("contradiction_within_document"),
          contradictionsBetweenDocuments: count("contradiction_between_documents"),
          contradictedByRecord: count("contradicted_by_record"),
          misquotedAuthorities: count("misquoted_authority"),
          misstatedNormContent: count("misstated_norm_content"),
          impossibleDateRanges: count("impossible_date_range"),
          unsubstantiatedAssertions: count("unsubstantiated_assertion"),
          absoluteAssertions: count("absolute_assertion"),
          ownRisks: analysis.exposure.length,
        },
        findings,
        briefSkeleton: brief?.text ?? null,
        briefIncludedFindingIds: brief?.included ?? [],
        briefExcludedFindings: brief?.excluded ?? [],
        exposure: analysis.exposure,
        authorityChecks,
        warnings,
        limitations: LIMITATIONS,
        requiresHumanReview: true as const,
      };
    },
  });
}
