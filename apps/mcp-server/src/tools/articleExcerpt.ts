/**
 * Extracto de un articulo adaptado a la cita.
 *
 * verify_review_findings devolvia siempre los primeros 600 caracteres del
 * articulo, de modo que una cita como "Art. 210 Abs. 6 OR" (el apartado 6 empieza
 * pasados 1 100 caracteres) mostraba un texto sin el apartado citado. Aqui se
 * devuelve el apartado pedido cuando se puede localizar con seguridad; si no, el
 * comienzo del articulo, como antes.
 */

const START_UPPER = String.raw`(?=[A-ZÄÖÜÀÂÉÈÊÎÔÙÇ"«„'(])`;

function paragraphStart(text: string, paragraph: number, from: number): number {
  // El apartado 1 sigue al encabezado; los siguientes empiezan tras un punto, parentesis,
  // dos puntos o punto y coma (asi " 2 SchKG" dentro de "Art. 83 Abs. 2 SchKG" no cuenta).
  const lead = paragraph === 1 ? String.raw`(?:^|\s)` : String.raw`(?<=[.)…:;])\s`;
  const re = new RegExp(String.raw`${lead}${paragraph}\s+${START_UPPER}`, "g");
  re.lastIndex = from;
  const match = re.exec(text);
  return match ? match.index + (/^\s/.test(match[0]) ? 1 : 0) : -1;
}

/** Texto del apartado N del articulo, o null si no se localiza con seguridad. */
export function articleParagraph(articleText: string, paragraph: number): string | null {
  if (!Number.isInteger(paragraph) || paragraph < 1) return null;
  let cursor = 0;
  let start = -1;
  for (let k = 1; k <= paragraph; k += 1) {
    const found = paragraphStart(articleText, k, cursor);
    if (found < 0) return null;
    start = found;
    cursor = found + String(k).length + 1;
  }
  const next = paragraphStart(articleText, paragraph + 1, cursor);
  return articleText.slice(start, next < 0 ? undefined : next).trim();
}

export function articleExcerptForCitation(
  articleText: string,
  citation: string,
  max = 600,
): string {
  const fallback = articleText.slice(0, max);
  const wanted = /\bAbs\.?\s*(\d{1,2})\b|\bal\.\s*(\d{1,2})\b|\bcpv\.\s*(\d{1,2})\b/i.exec(
    citation,
  );
  const number = Number(wanted?.[1] ?? wanted?.[2] ?? wanted?.[3]);
  if (!wanted || !Number.isInteger(number) || number < 1) return fallback;

  // Los apartados aparecen como " 1 Texto ... 2 Texto ..." en orden creciente.
  let cursor = 0;
  let start = -1;
  for (let k = 1; k <= number; k += 1) {
    const found = paragraphStart(articleText, k, cursor);
    if (found < 0) return fallback;
    start = found;
    cursor = found + String(k).length + 1;
  }
  const next = paragraphStart(articleText, number + 1, cursor);
  const body = articleText.slice(start, next < 0 ? undefined : next).trim();
  return body.length > max ? `${body.slice(0, max)}…` : body;
}
