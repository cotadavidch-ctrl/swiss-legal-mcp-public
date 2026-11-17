import { z } from "zod";
import type { ToolContext, ToolRegistry } from "@swiss-legal-mcp/core";
import { resolveOfficialSwissCase } from "./officialSwissCaseResolver.js";
import {
  extractQuotesFromDraft,
  lawSourceForAbbreviation,
  verifyQuoteAgainstText,
  type QuoteStatus,
  type QuoteVerification,
} from "./quoteVerifier.js";
import { normalizeFedlexIdentifier } from "./fedlexIdentifier.js";

const MAX_QUOTES = 40;

const articleSource = z.object({
  type: z.literal("article"),
  /** ELI de Fedlex (o fedlex:https://...), numero SR, o abreviatura soportada (OR, ZGB, ATSG...). */
  eli: z.string().min(1).max(300).optional(),
  systematicNumber: z.string().min(1).max(30).optional(),
  abbreviation: z.string().min(1).max(10).optional(),
  articleNumber: z.string().min(1).max(12),
  language: z.enum(["de", "fr", "it"]).default("de"),
  date: z.iso.date().optional(),
});
const caseSource = z.object({
  type: z.literal("case"),
  caseReference: z.string().min(1).max(300),
});
const sourceSchema = z.discriminatedUnion("type", [articleSource, caseSource]);
export type Source = z.infer<typeof sourceSchema>;

interface ItemResult {
  readonly index: number;
  readonly origin: "explicit" | "extracted_from_draft";
  readonly quote: string;
  readonly source: Record<string, unknown> | null;
  readonly sourceInferredFromCitation: boolean;
  readonly status: QuoteStatus | "no_source";
  readonly verification: QuoteVerification | null;
  readonly sourceNote: string | null;
}

export interface FetchedText {
  readonly ok: boolean;
  readonly text: string;
  readonly note: string | null;
  readonly label: string;
}

function sourceKey(s: Source): string {
  return s.type === "article"
    ? `A|${s.eli ?? ""}|${s.systematicNumber ?? ""}|${s.abbreviation ?? ""}|${s.articleNumber}|${s.language}|${s.date ?? ""}`
    : `C|${s.caseReference}`;
}

type Item = {
  origin: ItemResult["origin"];
  quote: string;
  source: Source | null;
  inferred: boolean;
};

export function registerQuoteTools(tools: ToolRegistry): void {
  tools.register({
    name: "verify_quoted_passages",
    description:
      "Verifica de forma LITERAL que cada cita textual aparece en el texto oficial de su fuente: un articulo de Fedlex (ELI, numero SR o abreviatura como OR/ATSG/BGG) o una sentencia federal (texto integro oficial verificado). Acepta citas explicitas ({quote, source}) y/o un borrador del que extrae las citas entrecomilladas con la referencia legal mas cercana del parrafo. Maneja elipsis ([...], ...). Estados: verified_exact, verified_normalized, near_match_altered (posible cita alterada, con el pasaje cercano), not_found, source_unavailable (sin texto oficial fiable; no equivale a 'no existe'). Solo comprueba que las palabras existen en la fuente: no valida pertinencia, interpretacion ni vigencia. Requiere revision humana.",
    inputSchema: {
      quotes: z
        .array(z.object({ quote: z.string().min(1).max(3000), source: sourceSchema }))
        .max(MAX_QUOTES)
        .optional(),
      draft: z.string().min(1).max(200_000).optional(),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input, context: ToolContext & { signal?: AbortSignal }) =>
      runQuoteVerification(input, context),
  });
}

export interface QuoteVerificationInput {
  readonly quotes?: readonly { quote: string; source: Source }[] | undefined;
  readonly draft?: string | undefined;
}

export async function runQuoteVerification(
  input: QuoteVerificationInput,
  context: ToolContext & { signal?: AbortSignal },
) {
  if (!input.quotes?.length && !input.draft) {
    return {
      status: "invalid_input" as const,
      warnings: ["Indique 'quotes' y/o 'draft'."],
    };
  }

  const items: Item[] = [];
  for (const q of input.quotes ?? []) {
    items.push({ origin: "explicit", quote: q.quote, source: q.source, inferred: false });
  }
  const skippedFromDraft: string[] = [];
  if (input.draft) {
    for (const e of extractQuotesFromDraft(input.draft)) {
      const base = { origin: "extracted_from_draft" as const, quote: e.quote, inferred: true };
      if (!e.citation) {
        items.push({ ...base, source: null });
      } else if (e.citation.type === "case") {
        items.push({
          ...base,
          source: { type: "case", caseReference: e.citation.reference },
        });
      } else {
        const law = lawSourceForAbbreviation(e.citation.abbreviation);
        if (!law) {
          skippedFromDraft.push(`${e.citation.raw}: abreviatura sin identificador comprobado`);
          items.push({ ...base, source: null });
        } else {
          items.push({
            ...base,
            source: {
              type: "article",
              ...(law.eli ? { eli: law.eli } : {}),
              ...(law.systematicNumber ? { systematicNumber: law.systematicNumber } : {}),
              articleNumber: e.citation.article,
              language: law.language,
            },
          });
        }
      }
    }
  }
  if (items.length > MAX_QUOTES) {
    return {
      status: "invalid_input" as const,
      warnings: [`Demasiadas citas (${items.length}); maximo ${MAX_QUOTES} por llamada.`],
    };
  }

  const cache = new Map<string, Promise<FetchedText>>();
  const fetchSource = (s: Source): Promise<FetchedText> => {
    const key = sourceKey(s);
    let p = cache.get(key);
    if (!p) {
      p = loadSourceText(s, context);
      cache.set(key, p);
    }
    return p;
  };

  const results: ItemResult[] = [];
  for (const [index, item] of items.entries()) {
    const common = {
      index,
      origin: item.origin,
      quote: item.quote,
      sourceInferredFromCitation: item.inferred && item.source !== null,
    };
    if (!item.source) {
      results.push({
        ...common,
        source: null,
        status: "no_source",
        verification: null,
        sourceNote:
          "No se encontro una referencia legal verificable junto a la cita: no se puede verificar contra ninguna fuente.",
      });
      continue;
    }
    const fetched = await fetchSource(item.source);
    if (!fetched.ok) {
      results.push({
        ...common,
        source: { ...item.source },
        status: "source_unavailable",
        verification: null,
        sourceNote: fetched.note,
      });
      continue;
    }
    const verification = verifyQuoteAgainstText(item.quote, fetched.text);
    results.push({
      ...common,
      source: { ...item.source },
      status: verification.status,
      verification,
      sourceNote: fetched.label,
    });
  }

  const count = (s: ItemResult["status"]) => results.filter((r) => r.status === s).length;
  const verified = count("verified_exact") + count("verified_normalized");
  return {
    status: "verified" as const,
    summary: {
      total: results.length,
      verified,
      verified_exact: count("verified_exact"),
      verified_normalized: count("verified_normalized"),
      near_match_altered: count("near_match_altered"),
      not_found: count("not_found"),
      source_unavailable: count("source_unavailable"),
      no_source: count("no_source"),
      all_verified: results.length > 0 && verified === results.length,
    },
    results,
    warnings: [
      "Verificacion LITERAL: confirma que las palabras aparecen en el texto de la fuente, no que la cita sea pertinente, este bien interpretada ni que la norma o sentencia siga vigente.",
      ...(input.draft
        ? [
            "Las fuentes de las citas extraidas del borrador se INFIEREN de la referencia mas cercana del parrafo: compruebe que es la correcta.",
          ]
        : []),
      ...skippedFromDraft,
    ],
    requiresHumanReview: true as const,
  };
}

export async function loadSourceText(
  s: Source,
  context: ToolContext & { signal?: AbortSignal },
): Promise<FetchedText> {
  try {
    if (s.type === "case") {
      const r = await resolveOfficialSwissCase({
        case_reference: s.caseReference,
        require_official_source: true,
        require_full_text: true,
        retrieval_mode: "full_text",
      });
      const text = r.fetch?.text;
      const official = r.legal_use?.reading_status === "full_text_verified_official";
      if (!text || !official || r.identity?.status !== "identity_verified") {
        return {
          ok: false,
          text: "",
          label: s.caseReference,
          note: `No hay texto integro oficial verificado de ${s.caseReference} (estado: ${r.legal_use?.reading_status ?? "desconocido"}, identidad: ${r.identity?.status ?? "desconocida"}). Esto NO significa que la cita sea falsa.`,
        };
      }
      return {
        ok: true,
        text,
        note: null,
        label: `${s.caseReference} (texto integro oficial verificado)`,
      };
    }

    const fedlex = context.legislationProviders?.get("fedlex");
    if (!fedlex) {
      return { ok: false, text: "", label: "fedlex", note: "Proveedor Fedlex no disponible." };
    }
    let eli = s.eli;
    let systematicNumber = s.systematicNumber;
    let language: "de" | "fr" | "it" = s.language;
    let date = s.date;
    if (s.abbreviation && !eli && !systematicNumber) {
      const law = lawSourceForAbbreviation(s.abbreviation);
      if (!law) {
        return {
          ok: false,
          text: "",
          label: s.abbreviation,
          note: `Abreviatura '${s.abbreviation}' sin identificador comprobado: indique eli o systematicNumber.`,
        };
      }
      eli = law.eli;
      systematicNumber = law.systematicNumber;
      language = law.language;
    }
    if (eli) {
      const id = normalizeFedlexIdentifier(eli);
      eli = id.workEli;
      date = date ?? id.date;
    }
    const doc = await fedlex.getArticle(
      {
        lawRef: {
          ...(eli ? { eli } : {}),
          ...(systematicNumber ? { systematicNumber } : {}),
          language,
          ...(date ? { date } : {}),
        },
        articleNumber: s.articleNumber,
      },
      context.signal,
    );
    const text = doc.fullText;
    if (!text || doc.contentNature !== "literal") {
      return {
        ok: false,
        text: "",
        label: doc.id,
        note: "Fedlex no devolvio el texto literal del articulo.",
      };
    }
    return { ok: true, text, note: null, label: doc.id };
  } catch (error) {
    return {
      ok: false,
      text: "",
      label: "error",
      note: `No se pudo obtener la fuente: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export type DraftQuoteCheckStatus = "passed" | "warning" | "failed" | "not_applicable";

export interface DraftQuoteCheck {
  readonly status: DraftQuoteCheckStatus;
  readonly total: number;
  readonly verified: number;
  readonly problems: readonly { readonly quote: string; readonly status: string }[];
  readonly note: string;
}

/**
 * Comprobacion para `readyForFiling`: verifica las citas entrecomilladas de un borrador contra la
 * fuente oficial. Sin citas -> not_applicable (no se hace ninguna peticion). Cualquier cita alterada
 * o ausente -> failed; si alguna no se pudo verificar (fuente no disponible o sin referencia) ->
 * warning. Solo si TODAS estan verificadas -> passed. Un borrador nunca queda listo con citas sin
 * verificar.
 */
export async function checkDraftQuotesForReadiness(
  draft: string,
  context: ToolContext & { signal?: AbortSignal },
): Promise<DraftQuoteCheck> {
  if (extractQuotesFromDraft(draft).length === 0) {
    return {
      status: "not_applicable",
      total: 0,
      verified: 0,
      problems: [],
      note: "El borrador no contiene citas entrecomilladas de 30 o mas caracteres.",
    };
  }
  const out = await runQuoteVerification({ draft }, context);
  if (out.status !== "verified") {
    return {
      status: "warning",
      total: 0,
      verified: 0,
      problems: [],
      note: "No se pudo ejecutar la verificacion de citas.",
    };
  }
  const problems = out.results
    .filter((r) => r.status !== "verified_exact" && r.status !== "verified_normalized")
    .map((r) => ({ quote: r.quote.slice(0, 80), status: r.status }));
  const altered = problems.some(
    (p) => p.status === "near_match_altered" || p.status === "not_found",
  );
  const status: DraftQuoteCheckStatus = altered
    ? "failed"
    : problems.length > 0
      ? "warning"
      : "passed";
  return {
    status,
    total: out.summary.total,
    verified: out.summary.verified,
    problems,
    note:
      status === "passed"
        ? "Todas las citas entrecomilladas aparecen literalmente en su fuente oficial."
        : altered
          ? "Hay citas alteradas o que no aparecen en su fuente oficial."
          : "Hay citas que no pudieron verificarse (fuente no disponible o sin referencia).",
  };
}
