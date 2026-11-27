/**
 * Busqueda por palabras para listados oficiales que solo se pueden filtrar en
 * local (ESTV, SECO, BSV). Antes se exigia que la consulta entera apareciera
 * como una sola cadena, de modo que "Kreisschreiben Abzug Unterhaltskosten" no
 * encontraba nada aunque cada palabra estuviera presente.
 *
 * Reglas (deterministas, sin relevancia opaca):
 * - La consulta se parte en palabras de 3 o mas letras.
 * - Una palabra acierta si aparece en el texto o, en palabras largas (9+ letras,
 *   tipicas de los compuestos alemanes), si aparece su raiz de 8 letras.
 * - Primero se devuelven los elementos donde aciertan TODAS las palabras; solo si
 *   no hay ninguno, los que aciertan al menos una, de mayor a menor numero de aciertos.
 */
export interface QueryRankResult<T> {
  readonly items: readonly T[];
  /** "all" = todas las palabras aciertan; "any" = solo algunas (resultado ampliado). */
  readonly mode: "all" | "any" | "none";
}

function queryTokens(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length >= 3),
    ),
  ];
}

function tokenHits(haystack: string, token: string): boolean {
  if (haystack.includes(token)) return true;
  return token.length >= 9 && haystack.includes(token.slice(0, 8));
}

export function rankByQuery<T>(
  items: readonly T[],
  getText: (item: T) => string,
  query: string | undefined,
): QueryRankResult<T> {
  const tokens = query === undefined ? [] : queryTokens(query);
  if (tokens.length === 0) return { items, mode: "all" };

  const scored = items.map((item, index) => {
    const haystack = getText(item).toLowerCase();
    const score = tokens.filter((token) => tokenHits(haystack, token)).length;
    return { item, index, score };
  });

  const all = scored.filter((entry) => entry.score === tokens.length);
  if (all.length > 0) return { items: all.map((entry) => entry.item), mode: "all" };

  const any = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  if (any.length > 0) return { items: any.map((entry) => entry.item), mode: "any" };

  return { items: [], mode: "none" };
}
