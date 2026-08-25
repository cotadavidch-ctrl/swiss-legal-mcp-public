import * as cheerio from "cheerio";

export type HtmlDocument = ReturnType<typeof cheerio.load>;

/**
 * Parser HTML compartido (cheerio) para SECO/BSV/ESTV -- evita que cada
 * proveedor implemente su propio parsing de `<a>`/tablas con expresiones
 * regulares sobre el documento completo (fragil e insegura). Elimina
 * explicitamente `<script>`/`<style>` antes de devolver el arbol: este
 * proyecto solo EXTRAE texto/atributos, nunca ejecuta ni re-renderiza HTML de
 * terceros, asi que este es el unico paso de saneamiento necesario.
 */
export function parseHtml(html: string): HtmlDocument {
  const $ = cheerio.load(html);
  $("script, style").remove();
  return $;
}

/** Texto visible saneado (sin script/style), para resumenes o excerpts. */
export function extractSanitizedText(html: string): string {
  const $ = parseHtml(html);
  return $.root().text().trim().replace(/\s+/g, " ");
}
