import { describe, expect, it } from "vitest";
import { LegislationProviderRegistry, ProviderRegistry, ToolRegistry } from "@swiss-legal-mcp/core";
import { registerLegalCouncilTools } from "../src/tools/legalCouncilTools.js";

function registry() {
  const tools = new ToolRegistry(new ProviderRegistry(), new LegislationProviderRegistry());
  registerLegalCouncilTools(tools);
  return tools;
}

const context = {} as never;

describe("validate_legal_council: errores de formato utiles", () => {
  it("un campo en camelCase dentro de una voz se rechaza y el error nombra los campos validos", async () => {
    const input = {
      voices: [
        {
          voice_id: "my_advocate",
          position: "Posicion razonada",
          outcome_leaning: "mixed",
          confidence: "low",
          arguments: [{ claim: "Argumento", norms: [], factsUsed: ["f1"] }],
        },
      ],
      verify_norms: false,
      verify_authorities: false,
    };
    const error = await registry()
      .call("validate_legal_council", input, context)
      .then(
        () => null,
        (e: Error) => e,
      );
    expect(error).not.toBeNull();
    expect(error!.message).toContain("factsUsed");
    expect(error!.message).toContain("facts_used");
  });

  it("un campo desconocido en la raiz tambien lista los campos validos", async () => {
    const error = await registry()
      .call("validate_legal_council", { voices: [], crossReview: [] }, context)
      .then(
        () => null,
        (e: Error) => e,
      );
    expect(error!.message).toContain("crossReview");
    expect(error!.message).toContain("cross_review");
  });
});
