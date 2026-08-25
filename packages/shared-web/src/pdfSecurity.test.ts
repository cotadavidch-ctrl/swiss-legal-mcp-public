import { describe, expect, it } from "vitest";
import { inspectPdfSecurity } from "./pdfSecurity.js";

const MINIMAL_PDF = new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`);

describe("inspectPdfSecurity", () => {
  it("clasifica un PDF minimo como seguro", () => {
    const result = inspectPdfSecurity(MINIMAL_PDF);
    expect(result.status).toBe("safe");
    expect(result.originalHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rechaza magic bytes invalidos", () => {
    expect(inspectPdfSecurity(new TextEncoder().encode("not a pdf")).status).toBe("malformed");
  });

  it("detecta PDFs cifrados", () => {
    const bytes = new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Encrypt 2 0 R >>
endobj
%%EOF
`);
    const result = inspectPdfSecurity(bytes);
    expect(result.status).toBe("encrypted");
    expect(result.warnings).toContain("encrypted");
  });

  it("detecta contenido activo sin ejecutarlo", () => {
    const bytes = new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog /OpenAction 2 0 R >>
endobj
2 0 obj
<< /S /JavaScript /JS (app.alert("x")) >>
endobj
%%EOF
`);
    const result = inspectPdfSecurity(bytes);
    expect(result.status).toBe("active_content_detected");
    expect(result.warnings).toContain("open_action");
    expect(result.warnings).toContain("javascript");
  });

  it("advierte sobre updates incrementales o trailing data", () => {
    const bytes = new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog >>
endobj
%%EOF
trailing
`);
    const result = inspectPdfSecurity(bytes);
    expect(result.status).toBe("safe_with_warnings");
    expect(result.warnings).toContain("trailing_data_or_missing_eof");
  });

  it("aplica limite de tamano antes del parser PDF", () => {
    expect(inspectPdfSecurity(MINIMAL_PDF, { maxBytes: 4 }).status).toBe("too_large");
  });
});
