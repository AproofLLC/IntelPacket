import { describe, expect, it } from "vitest";
import { IntelPacketPIIError, protectPII, validatePrivacyPolicy } from "../../src/index.js";

describe("fail-closed behavior", () => {
  it("unhandled ssn throws", () => {
    expect(() => protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1" }))).toThrow(
      IntelPacketPIIError,
    );
  });

  it("unhandled email throws", () => {
    expect(() => protectPII({ email: "a@b.example" }, validatePrivacyPolicy({ version: "v1" }))).toThrow(
      IntelPacketPIIError,
    );
  });

  it("unhandled account number throws", () => {
    expect(() =>
      protectPII({ account_number: "000111222333" }, validatePrivacyPolicy({ version: "v1" })),
    ).toThrow(IntelPacketPIIError);
  });

  it("unhandled nested PII throws", () => {
    expect(() =>
      protectPII({ patient: { ssn: "123-45-6789" } }, validatePrivacyPolicy({ version: "v1" })),
    ).toThrow(IntelPacketPIIError);
  });

  it("unhandled array PII throws", () => {
    expect(() =>
      protectPII({ rows: [{ email: "x@y.co" }] }, validatePrivacyPolicy({ version: "v1" })),
    ).toThrow(IntelPacketPIIError);
  });

  it("error has safe code", () => {
    try {
      protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1" }));
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(IntelPacketPIIError);
      expect((e as IntelPacketPIIError).code).toBe("UNHANDLED_PII_FIELD");
    }
  });

  it("error includes field paths", () => {
    try {
      protectPII({ email: "user@domain.example" }, validatePrivacyPolicy({ version: "v1" }));
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(IntelPacketPIIError);
      expect((e as IntelPacketPIIError).fieldPaths.some((p) => p.includes("email"))).toBe(true);
    }
  });

  it("error does NOT include raw PII values in message", () => {
    try {
      protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1" }));
      expect.fail("expected throw");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg.includes("123-45")).toBe(false);
    }
  });

  it("failOnUnhandledPII false does not disable fail-closed throws", () => {
    expect(() =>
      protectPII(
        { email: "x@y.com" },
        validatePrivacyPolicy({ version: "v1", mode: "fail-closed" }),
        { failOnUnhandledPII: false },
      ),
    ).toThrow(IntelPacketPIIError);
  });
});
