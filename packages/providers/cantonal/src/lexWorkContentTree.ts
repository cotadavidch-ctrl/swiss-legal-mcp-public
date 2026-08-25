import { extractSanitizedText } from "@swiss-legal-mcp/shared-web";
import type { LexWorkContentNode } from "./lexWorkRemoteTypes.js";

/**
 * Utilidades puras sobre el arbol recursivo real de `show_as_json`
 * (titulo -> articulo -> parrafo...), ver lexWorkRemoteTypes.ts. No hacen
 * peticiones de red.
 */

function collectNodeText(node: LexWorkContentNode, lang: string): string[] {
  const own = node.text?.[lang];
  const ownHtml = node.html_content?.[lang];
  const pieces: string[] = [];
  if (own) {
    pieces.push(own);
  } else if (ownHtml) {
    pieces.push(extractSanitizedText(ownHtml));
  }
  for (const child of node.children ?? []) {
    pieces.push(...collectNodeText(child, lang));
  }
  return pieces;
}

export function extractFullText(root: LexWorkContentNode, lang: string): string {
  return collectNodeText(root, lang)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)
    .join("\n\n");
}

/** Normaliza "Art.&nbsp;1", "Art. 1", "1" al mismo identificador comparable ("1"). */
export function normalizeArticleNumber(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "")
    .replace(/^art\.?/i, "")
    .toLowerCase();
}

export function findArticleNode(
  root: LexWorkContentNode,
  articleNumber: string,
  lang: string,
): LexWorkContentNode | undefined {
  const target = normalizeArticleNumber(articleNumber);
  const stack: LexWorkContentNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node.type === "article") {
      const candidate = node.number?.[lang];
      if (candidate && normalizeArticleNumber(candidate) === target) {
        return node;
      }
    }
    for (const child of node.children ?? []) stack.push(child);
  }
  return undefined;
}
