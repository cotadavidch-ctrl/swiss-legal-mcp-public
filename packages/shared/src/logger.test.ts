import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("redacta secretos en cabeceras y objetos anidados", () => {
    const lines: string[] = [];
    const logger = createLogger(
      { level: "info", name: "test" },
      {
        write: (line: string) => lines.push(line),
      },
    );

    logger.info({
      headers: {
        authorization: "Bearer secret-token-value",
        cookie: "session=secret",
      },
      nested: {
        apiKey: "secret-api-key",
        password: "secret-password",
      },
    });

    const output = lines.join("\n");
    expect(output).toContain("[redacted]");
    expect(output).not.toContain("secret-token-value");
    expect(output).not.toContain("session=secret");
    expect(output).not.toContain("secret-api-key");
    expect(output).not.toContain("secret-password");
  });
});
