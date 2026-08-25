import { XMLParser, XMLValidator } from "fast-xml-parser";

/**
 * Parser de Akoma Ntoso para las manifestaciones XML reales de Fedlex (ver
 * tests/fixtures/fedlex/akoma_ntoso_constitution_de_20240303.xml, 232
 * elementos <article eId="art_N"> verificados). Protecciones de seguridad
 * verificadas contra el codigo fuente REAL de fast-xml-parser@5.10.1 (no
 * asumidas):
 *
 * - Entidades externas (`<!ENTITY x SYSTEM "...">`): fast-xml-parser lanza
 *   "External entities are not supported" (src/xmlparser/DocTypeReader.js,
 *   readEntityExp) siempre que se le pase un objeto de opciones (no false).
 * - Ademas, aqui se rechaza cualquier documento con un DOCTYPE ANTES de
 *   pasarlo al parser (ver assertNoDoctype), para no depender unicamente de
 *   esa proteccion interna.
 * - `processEntities: { enabled: false }` desactiva por completo la
 *   sustitucion de entidades internas (opcion real, ver
 *   src/xmlparser/OptionsBuilder.js normalizeProcessEntities) -- el
 *   documento real de Fedlex no declara ningun DOCTYPE ni entidad propia,
 *   asi que esto no pierde ninguna capacidad real.
 * - Limite de tamano aplicado ANTES de invocar al parser (proteccion contra
 *   bombas XML independiente de la libreria).
 * - `XMLValidator.validate()` (funcion real y exportada por la libreria,
 *   src/validator.js) se ejecuta ANTES de `XMLParser.parse()`: se descubrio
 *   durante las pruebas de esta fase que `XMLParser` es deliberadamente
 *   tolerante (no lanza con algunas etiquetas mal cerradas), asi que confiar
 *   solo en el parser no habria detectado XML malformado de forma fiable.
 */

const MAX_XML_BYTES_DEFAULT = 20_000_000;

export class XmlSecurityError extends Error {}

function assertNoDoctype(xml: string): void {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new XmlSecurityError(
      "Documento XML rechazado: contiene un DOCTYPE. Los manifiestos Akoma Ntoso reales de Fedlex no declaran ninguno.",
    );
  }
}

function assertSize(xml: string, maxBytes: number): void {
  const byteLength = Buffer.byteLength(xml, "utf8");
  if (byteLength > maxBytes) {
    throw new XmlSecurityError(
      `Documento XML rechazado: ${byteLength} bytes supera el limite de ${maxBytes} bytes.`,
    );
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: { enabled: false },
  htmlEntities: false,
  isArray: (tagName) =>
    ["article", "paragraph", "item", "section", "chapter", "subdivision", "p"].includes(tagName),
});

export type XmlNode = Record<string, unknown>;

function assertWellFormed(xml: string): void {
  const result = XMLValidator.validate(xml);
  if (result !== true) {
    throw new XmlSecurityError(
      `Documento XML mal formado: ${result.err.msg} (linea ${result.err.line}).`,
    );
  }
}

/** Parsea un documento Akoma Ntoso real de Fedlex, aplicando limites de tamano, validacion estructural y rechazando DOCTYPE/entidades externas. */
export function parseAkomaNtosoXml(xml: string, maxBytes: number = MAX_XML_BYTES_DEFAULT): XmlNode {
  assertSize(xml, maxBytes);
  assertNoDoctype(xml);
  assertWellFormed(xml);
  return parser.parse(xml) as XmlNode;
}

/**
 * Recorre recursivamente el arbol buscando el primer nodo cuyo atributo
 * `@_eId` sea exactamente `eId`. No asume una forma de arbol concreta mas
 * alla de lo verificado en la fixture real (objetos anidados y arrays para
 * las etiquetas declaradas en `isArray`).
 */
export function findNodeByEId(tree: unknown, eId: string): XmlNode | undefined {
  if (Array.isArray(tree)) {
    for (const item of tree) {
      const found = findNodeByEId(item, eId);
      if (found) return found;
    }
    return undefined;
  }
  if (tree !== null && typeof tree === "object") {
    const node = tree as XmlNode;
    if (node["@_eId"] === eId) {
      return node;
    }
    for (const value of Object.values(node)) {
      const found = findNodeByEId(value, eId);
      if (found) return found;
    }
  }
  return undefined;
}

/** Concatena, en orden, todos los nodos de texto descendientes de `node`. */
export function extractText(node: unknown): string {
  const parts: string[] = [];
  collectText(node, parts);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function collectText(node: unknown, parts: string[]): void {
  if (typeof node === "string") {
    const trimmed = node.trim();
    if (trimmed.length > 0) parts.push(trimmed);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectText(item, parts);
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node as XmlNode)) {
      if (key === "#text") {
        collectText(value, parts);
      } else if (!key.startsWith("@_")) {
        collectText(value, parts);
      }
    }
  }
}

/**
 * Convierte un numero de articulo tal como lo pediria un usuario ("104",
 * "104a", "104 bis") al eId real observado en Fedlex ("art_104", "art_104_a").
 * Solo se admite el patron verificado en la fixture real: digitos seguidos
 * opcionalmente de una unica letra minuscula.
 */
export function articleNumberToEId(articleNumber: string): string {
  const match = /^(\d+)([a-z])?$/i.exec(articleNumber.trim());
  if (!match) {
    throw new XmlSecurityError(`Numero de articulo con formato no reconocido: '${articleNumber}'.`);
  }
  const [, digits, letter] = match;
  return letter ? `art_${digits}_${letter.toLowerCase()}` : `art_${digits}`;
}

export interface AkomaNtosoArticle {
  readonly eId: string;
  readonly articleNumber: string;
  readonly heading?: string;
  readonly fullText: string;
}

/** Localiza un articulo real por numero y devuelve su texto literal completo (heading + cuerpo). */
export function findArticleByNumber(
  tree: XmlNode,
  articleNumber: string,
): AkomaNtosoArticle | undefined {
  const eId = articleNumberToEId(articleNumber);
  const node = findNodeByEId(tree, eId);
  if (!node) return undefined;
  const headingRaw = (node as { heading?: unknown }).heading;
  const heading = headingRaw !== undefined ? extractText(headingRaw) : undefined;
  return {
    eId,
    articleNumber,
    ...(heading && heading.length > 0 ? { heading } : {}),
    fullText: extractText(node),
  };
}

/**
 * Localiza un articulo dentro de un anexo especifico. `annexId` es el
 * prefijo tal como aparece en los eId de Fedlex (e.g. "annex_I" para Anexo
 * I del FZA). Busca el primer articulo cuyo eId empiece por `${annexId}/` y
 * termine con `/${articleEId}`, sin importar los niveles estructurales
 * intermedios (lvl_u1, lvl_I, lvl_II, etc.). No cae silenciosamente al
 * cuerpo principal si no hay coincidencia: devuelve undefined.
 */
export function findArticleInAnnex(
  tree: XmlNode,
  annexId: string,
  articleNumber: string,
): AkomaNtosoArticle | undefined {
  const articleEId = articleNumberToEId(articleNumber);
  const prefix = `${annexId}/`;
  const suffix = `/${articleEId}`;
  const allEIds = listArticleEIds(tree);
  const matchedEId = allEIds.find((eid) => eid.startsWith(prefix) && eid.endsWith(suffix));
  if (!matchedEId) return undefined;
  const node = findNodeByEId(tree, matchedEId);
  if (!node) return undefined;
  const headingRaw = (node as { heading?: unknown }).heading;
  const heading = headingRaw !== undefined ? extractText(headingRaw) : undefined;
  return {
    eId: matchedEId,
    articleNumber,
    ...(heading && heading.length > 0 ? { heading } : {}),
    fullText: extractText(node),
  };
}

/** Lista todos los eId de elementos <article> presentes -- usado en pruebas para verificar cobertura real. */
export function listArticleEIds(tree: unknown): string[] {
  const found: string[] = [];
  collectArticleEIds(tree, found);
  return found;
}

function collectArticleEIds(node: unknown, found: string[], insideArticle = false): void {
  if (Array.isArray(node)) {
    for (const item of node) collectArticleEIds(item, found, insideArticle);
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node as XmlNode)) {
      if (key === "article") {
        if (Array.isArray(value)) {
          for (const article of value) {
            const eId = (article as XmlNode)["@_eId"];
            if (typeof eId === "string") found.push(eId);
          }
        }
      } else if (!key.startsWith("@_") && key !== "#text") {
        collectArticleEIds(value, found, insideArticle);
      }
    }
  }
}
