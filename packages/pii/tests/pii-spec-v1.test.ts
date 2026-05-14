import { describe, expect, it } from "vitest";
import {
  assertSupportedIntelPacketPIIVersion,
  createPIIPacket,
  detectPII,
  hmacField,
  INTELPACKET_PII_SPEC_VERSION,
  protectPII,
  replayPacket,
  tokenizeField,
  validatePrivacyPolicy,
  verifyIntelPacket,
} from "../src/index.js";

const POL_BASE = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  allow: ["id"],
});

describe("IntelPacket PII Spec v1", () => {
  it("privacy report includes PII spec version", () => {
    const out = protectPII({ id: "1" }, POL_BASE);
    expect(out.report.pii_spec_version).toBe(INTELPACKET_PII_SPEC_VERSION);
  });

  it("redact removes raw value", () => {
    const pol = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      redact: ["secret"],
      allow: ["id", "secret"],
    });
    const out = protectPII({ id: "1", secret: "xyzzy" }, pol);
    expect(JSON.stringify(out.data).includes("xyzzy")).toBe(false);
  });

  it("mask hides raw value but preserves partial format", () => {
    const pol = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      mask: ["phone"],
      allow: ["phone"],
    });
    const out = protectPII({ phone: "5551234567" }, pol);
    const v = (out.data as { phone: string }).phone;
    expect(v.includes("*")).toBe(true);
    expect(v).not.toBe("5551234567");
  });

  it("tokenize is deterministic with same secret", () => {
    const a = tokenizeField("p", "v", "secret-one________________");
    const b = tokenizeField("p", "v", "secret-one________________");
    expect(a).toBe(b);
  });

  it("tokenize differs with different secret", () => {
    const a = tokenizeField("p", "v", "secret-one________________");
    const b = tokenizeField("p", "v", "secret-two________________");
    expect(a).not.toBe(b);
  });

  it("hmac is deterministic with same secret", () => {
    const a = hmacField("p", "v", "hsecret-one______________");
    const b = hmacField("p", "v", "hsecret-one______________");
    expect(a).toBe(b);
  });

  it("hmac differs with different secret", () => {
    const a = hmacField("p", "v", "hsecret-one______________");
    const b = hmacField("p", "v", "hsecret-two______________");
    expect(a).not.toBe(b);
  });

  it("raw secret is never included in report", () => {
    const secret = "tok-secret-unique-value-12345!!";
    const out = protectPII(
      { id: "1", email: "a@b.c" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["email"],
        allow: ["id", "email"],
      }),
      { tokenSecret: secret },
    );
    expect(JSON.stringify(out.report).includes(secret)).toBe(false);
  });

  it("raw protected values are not included in transformed safe data for redacted path", () => {
    const raw = "999-99-9999";
    const pol = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      redact: ["ssn"],
      allow: ["ssn"],
    });
    const out = protectPII({ ssn: raw }, pol);
    expect(JSON.stringify(out.data).includes(raw)).toBe(false);
  });

  it("adapter-created packet includes IntelPacket spec_version and ip_version", () => {
    const { packet } = createPIIPacket(
      { id: "1" },
      { version: "v1", allow: ["id"] },
      { packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" } },
    );
    expect(packet.ip_version).toBe("1");
    expect(packet.spec_version).toBe("1");
  });

  it("adapter-created packet replays successfully through core", () => {
    const { packet } = createPIIPacket(
      { id: "1", email: "nobody@example.com" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        mask: ["email"],
        allow: ["id", "email"],
      }),
      { packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" } },
    );
    expect(verifyIntelPacket(packet)).toBe(true);
    const st = replayPacket(packet);
    expect(st.canonical).toEqual(expect.any(Object));
  });

  it("invalid policy paths are rejected", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        redact: ["__proto__"],
      }),
    ).toThrow();
  });

  it("unsafe prototype pollution paths are rejected in policy", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        allow: ["constructor.foo"],
      }),
    ).toThrow();
  });

  it("detection report does not leak full raw sensitive values in field names only", () => {
    const res = detectPII({ user_password: "super-secret-password-123" });
    const blob = JSON.stringify(res.fields);
    expect(blob.includes("super-secret-password-123")).toBe(false);
  });

  it("assertSupportedIntelPacketPIIVersion accepts protectPII report", () => {
    const out = protectPII({ id: "1" }, POL_BASE);
    expect(() => assertSupportedIntelPacketPIIVersion(out.report)).not.toThrow();
  });

  it("assertSupportedIntelPacketPIIVersion rejects wrong pii_spec_version", () => {
    const out = protectPII({ id: "1" }, POL_BASE);
    const bad = { ...out.report, pii_spec_version: "99" as "1" };
    expect(() => assertSupportedIntelPacketPIIVersion(bad)).toThrow(/Unsupported or missing IntelPacket PII spec version/i);
  });
});
