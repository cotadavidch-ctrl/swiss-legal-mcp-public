/**
 * Normalizador compartido y estricto de identificadores Fedlex.
 *
 * Acepta exactamente las formas que producen/consumen las herramientas MCP:
 *   - `fedlex:https://fedlex.data.admin.ch/eli/cc/27/317_321_377`          (search_legislation)
 *   - `fedlex:https://fedlex.data.admin.ch/eli/cc/27/317_321_377/20240101/de`  (get_law)
 *   - `fedlex:https://fedlex.data.admin.ch/eli/cc/27/317_321_377/20240101/de/art_41` (get_article)
 *   - `https://fedlex.data.admin.ch/eli/...` y `https://www.fedlex.admin.ch/eli/...`
 *   - sufijos opcionales: fecha de consolidacion (AAAAMMDD), idioma (de|fr|it), `/art_N`.
 *
 * Devuelve el ELI de la obra (lo que espera FedlexProvider) mas version temporal,
 * idioma y articulo cuando el identificador los contiene. Rechaza cualquier otro
 * protocolo, dominio, credencial, puerto, query o fragmento.
 */
export const FEDLEX_ALLOWED_HOSTS = ["fedlex.data.admin.ch", "www.fedlex.admin.ch"] as const;
const CANONICAL_HOST = "fedlex.data.admin.ch";

export interface NormalizedFedlexIdentifier {
  /** ELI de la obra, siempre `https://fedlex.data.admin.ch/eli/...` sin sufijos. */
  readonly workEli: string;
  /** Fecha de consolidacion AAAAMMDD convertida a ISO (AAAA-MM-DD), si estaba presente. */
  readonly date?: string;
  readonly language?: "de" | "fr" | "it";
  readonly articleNumber?: string;
}

export class InvalidFedlexIdentifierError extends Error {
  constructor(
    readonly input: string,
    readonly reason: string,
  ) {
    super(`Identificador Fedlex no valido (${reason}): '${input.slice(0, 200)}'.`);
    this.name = "InvalidFedlexIdentifierError";
  }
}

export function isFedlexIdentifier(value: string): boolean {
  return /^(fedlex:)?https:\/\/(fedlex\.data|www\.fedlex)\.admin\.ch\/eli\//i.test(value.trim());
}

export function normalizeFedlexIdentifier(raw: string): NormalizedFedlexIdentifier {
  const input = raw.trim();
  const stripped = input.replace(/^fedlex:/i, "");
  if (/^fedlex:/i.test(stripped)) throw new InvalidFedlexIdentifierError(raw, "prefijo repetido");
  let url: URL;
  try {
    url = new URL(stripped);
  } catch {
    throw new InvalidFedlexIdentifierError(raw, "no es una URL");
  }
  if (url.protocol !== "https:") throw new InvalidFedlexIdentifierError(raw, "protocolo no HTTPS");
  if (url.username || url.password) throw new InvalidFedlexIdentifierError(raw, "credenciales");
  if (url.port) throw new InvalidFedlexIdentifierError(raw, "puerto no permitido");
  if (url.search || url.hash) throw new InvalidFedlexIdentifierError(raw, "query o fragmento");
  const host = url.hostname.toLowerCase();
  if (!(FEDLEX_ALLOWED_HOSTS as readonly string[]).includes(host)) {
    throw new InvalidFedlexIdentifierError(raw, "dominio no autorizado");
  }
  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  if (segments[0] !== "eli" || segments.length < 3) {
    throw new InvalidFedlexIdentifierError(raw, "no es un ELI");
  }
  if (!segments.every((segment) => /^[A-Za-z0-9_.-]+$/.test(segment))) {
    throw new InvalidFedlexIdentifierError(raw, "segmento de ruta no permitido");
  }

  let articleNumber: string | undefined;
  let language: "de" | "fr" | "it" | undefined;
  let date: string | undefined;
  const last = segments[segments.length - 1]!;
  const artMatch = /^art_([0-9]+[a-z_]*)$/i.exec(last);
  if (artMatch) {
    articleNumber = artMatch[1]!.replace(/_/g, "");
    segments.pop();
  }
  const maybeLang = segments[segments.length - 1];
  if (maybeLang === "de" || maybeLang === "fr" || maybeLang === "it") {
    language = maybeLang;
    segments.pop();
  }
  const maybeDate = segments[segments.length - 1];
  if (maybeDate && /^\d{8}$/.test(maybeDate)) {
    const iso = `${maybeDate.slice(0, 4)}-${maybeDate.slice(4, 6)}-${maybeDate.slice(6, 8)}`;
    if (Number.isNaN(Date.parse(iso))) throw new InvalidFedlexIdentifierError(raw, "fecha");
    date = iso;
    segments.pop();
  }
  if (segments.length < 3) throw new InvalidFedlexIdentifierError(raw, "ELI de obra incompleto");
  return {
    workEli: `https://${CANONICAL_HOST}/${segments.join("/")}`,
    ...(date ? { date } : {}),
    ...(language ? { language } : {}),
    ...(articleNumber ? { articleNumber } : {}),
  };
}
