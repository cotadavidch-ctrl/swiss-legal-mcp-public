import { describe, expect, it } from "vitest";
import { extractJudgmentText } from "../src/tools/officialSwissCaseResolver.js";

describe("extractJudgmentText", () => {
  const html = `<body><div id="nav">menu Rechtsprechung Abonnement</div>
<div id="highlight_result" class="box"><div class="content"><p class="para">Tribunale federale<br/>
Tribunal federal</p>\n\n\n\t<p>Urteil vom 1.&nbsp;Dezember 2004</p></div></div>
<div id="highlight_navigation" class="box"><div class="content">Zur Liste zurueck</div></div></body>`;
  it("conserva solo el fallo, sin navegacion, con espacios normalizados", () => {
    const t = extractJudgmentText(html);
    expect(t).toContain("Tribunale federale");
    expect(t).toContain("Urteil vom 1. Dezember 2004");
    expect(t).not.toMatch(/menu|Abonnement|Zur Liste/);
    expect(t).not.toMatch(/\t|\n{3,}/);
  });
  it("sin contenedor conserva todo el documento", () => {
    expect(extractJudgmentText("<p>texto  libre</p>")).toBe("texto libre");
  });
});
