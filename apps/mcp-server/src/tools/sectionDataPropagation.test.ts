import { describe, expect, it } from "vitest";
import { extractSectionsWithEvidence } from "./officialSwissCaseResolver.js";

// Test to reproduce the data propagation bug where section content is lost
// between extraction and the normalized document

describe("Section data propagation bug", () => {
  it("should preserve section content from extraction to normalized document", () => {
    // Arrange: Create mock HTML content with all required sections
    const mockHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="iso-8859-1">
          <title>Test Case 1C_374/2023</title>
      </head>
      <body>
          <div class="decision-content">
              <div class="case-header">1C_374/2023 12.12.2023</div>

              <div class="section facts">
                  <h2>Sachverhalt</h2>
                  <p>Die Parteien liegen in nachbarschaftlichem Streit. Mit Urteil vom 18. Juli 2024 wies das Bezirksgericht Meilen die Schadenersatzklage des Beschwerdeführers im Zusammenhang mit dem Rückschnitt eines Holunderstrauchs mangels eines Nachweises eines Schadens bzw. einer immateriellen Unbill ab...</p>
              </div>

              <div class="section procedural-history">
                  <h2>Procedural History</h2>
                  <p>Auf die hiergegen erhobene Beschwerde trat das Obergericht des Kantons Zürich mit Beschluss vom 7. November 2024 mangels konkreter Rechtsbegehren und mangels hinreichender Begründung nicht ein.</p>
              </div>

              <div class="section party-arguments">
                  <h2>Party Arguments</h2>
                  <p>Mit Beschwerde vom 5. Dezember 2024 (Postaufgabe 7. Dezember 2024) wendet sich der Beschwerdeführer an das Bundesgericht. Er verlangt sinngemäss eine Entschädigung von Fr. 5'000.--...</p>
              </div>

              <div class="section reasoning">
                  <h2>Erwägungen</h2>
                  <div class="subsection">
                      <h3>1.</h3>
                      <p>Der Streitwert beträgt nach den unbeanstandeten Feststellungen im angefochtenen Beschluss rund Fr. 10'000.--...</p>
                  </div>
              </div>

              <div class="section dispositive">
                  <h2>Dispositiv</h2>
                  <p>Demnach erkennt der Präsident:</p>
                  <ol>
                      <li>Auf die Beschwerde wird nicht eingetreten.</li>
                      <li>Die Gerichtskosten von Fr. 1'000.-- werden dem Beschwerdeführer auferlegt.</li>
                  </ol>
              </div>
          </div>
      </body>
      </html>
    `;

    // Act: Extract sections with evidence
    const { sections, evidence: sectionDetectionEvidence } =
      extractSectionsWithEvidence(mockHtmlContent);

    // Assert: Verify that sections were extracted correctly
    expect(Object.keys(sections)).toContain("facts");
    expect(Object.keys(sections)).toContain("procedural_history");
    expect(Object.keys(sections)).toContain("party_arguments");
    expect(Object.keys(sections)).toContain("reasoning");
    expect(Object.keys(sections)).toContain("dispositive");
    expect(sectionDetectionEvidence["facts"]?.detection_method).toBeTruthy();

    // CRITICAL ASSERTION: The facts section should NOT be empty
    const factsContent = sections["facts"];
    expect(factsContent).toBeDefined();
    expect(factsContent).not.toBe("");
    expect(factsContent?.trim().length).toBeGreaterThan(0);

    // Also verify that section_evidence would show this as extracted
    // (we can't directly test buildSectionEvidence here without more setup,
    // but we can infer from the sections content)

    // The bug would manifest as: factsContent === "" despite the raw content having facts
  });

  // Additional test for party_arguments since it was also affected in our analysis
  it("should preserve party_arguments section content", () => {
    // Arrange: Similar content but focus on party_arguments
    const mockHtmlContent = `
      <!DOCTYPE html>
      <html>
      <body>
          <div class="section facts">
              <h2>Sachverhalt</h2>
              <p>Brief facts about the case.</p>
          </div>
          
          <div class="section party-arguments">
              <h2>Party Arguments</h2>
              <p>Der Beschwerdeführer macht geltend, die Vorinstanz habe seine Anträge nicht berücksichtigt. Er verlangt sinngemäss eine Entschädigung von Fr. 5'000.--...</p>
          </div>
          
          <div class="section reasoning">
              <h2>Erwägungen</h2>
              <p>Some reasoning content.</p>
          </div>
      </body>
      </html>
    `;

    // Act
    const { sections } = extractSectionsWithEvidence(mockHtmlContent);

    // Assert
    expect(Object.keys(sections)).toContain("party_arguments");
    const partyArgsContent = sections["party_arguments"];
    expect(partyArgsContent).toBeDefined();
    expect(partyArgsContent).not.toBe("");
    expect(partyArgsContent?.trim().length).toBeGreaterThan(0);
  });
});
