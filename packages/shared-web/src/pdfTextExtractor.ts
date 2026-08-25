import {
  NonTextualDocumentError,
  ParseError,
  ResponseTooLargeError,
  SecurityError,
} from "@swiss-legal-mcp/core";
import { PDFParse } from "pdf-parse";
import { inspectPdfSecurity, type PdfSecurityInspection } from "./pdfSecurity.js";

export interface ExtractedPdfText {
  readonly text: string;
  readonly pageCount: number;
  readonly pages: readonly {
    readonly pageNumber: number;
    readonly text: string;
    readonly textLength: number;
  }[];
  readonly security: PdfSecurityInspection;
}

/**
 * Umbral heuristico para distinguir un PDF textual real de uno escaneado
 * (imagen sin capa de texto): verificado en vivo en Fase 4 contra los tres
 * PDF reales de SECO/BSV/ESTV (111, 136 y 5 paginas respectivamente), todos
 * muy por encima de este minimo. Fase 4 no implementa OCR salvo para
 * documentos escaneados sin alternativa textual (ninguno de los tres
 * encontrados lo era) -- un PDF que no supere el umbral se rechaza con
 * NonTextualDocumentError en vez de intentar OCR silenciosamente.
 */
const MIN_CHARS_PER_PAGE = 20;

/**
 * Extrae texto real de un PDF (packages/shared-web, usado por
 * SECO/BSV/ESTV). Envuelve `pdf-parse` (pdf.js) y valida que el resultado
 * parezca texto real, no una imagen escaneada sin capa de texto.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPdfText> {
  const security = inspectPdfSecurity(bytes);
  if (security.status === "too_large") {
    throw new ResponseTooLargeError("(pdf en memoria)", bytes.byteLength);
  }
  if (security.status === "malformed") {
    throw new ParseError("PDF malformado o sin magic bytes validos.", {
      warnings: security.warnings,
      originalHash: security.originalHash,
    });
  }
  if (security.status === "encrypted") {
    throw new SecurityError("PDF cifrado rechazado para extraccion pasiva.", {
      warnings: security.warnings,
      originalHash: security.originalHash,
    });
  }
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    const pageCount = result.total;
    const pages = result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text,
      textLength: page.text.trim().length,
    }));
    const charsPerPage = pageCount > 0 ? result.text.length / pageCount : 0;
    if (charsPerPage < MIN_CHARS_PER_PAGE) {
      throw new NonTextualDocumentError(
        "(pdf en memoria)",
        `El PDF tiene ${pageCount} pagina(s) pero solo ${result.text.length} caracteres de texto extraible ` +
          `(${charsPerPage.toFixed(1)}/pagina, minimo ${MIN_CHARS_PER_PAGE}); posible documento escaneado. No se aplico OCR.`,
      );
    }
    return { text: result.text, pageCount, pages, security };
  } finally {
    await parser.destroy();
  }
}
