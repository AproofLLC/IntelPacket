import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));

describe("docs positioning (README + compliance)", () => {
  it("README frames IntelPacketPII as any-system / multi-industry — not healthcare-only", () => {
    const readme = readFileSync(join(root, "..", "..", "README.md"), "utf8");
    const lower = readme.toLowerCase();
    expect(
      lower.includes("any system") ||
        lower.includes("any industry") ||
        lower.includes("across industries") ||
        lower.includes("not a single industry"),
    ).toBe(true);
    expect(lower.includes("healthcare records") || lower.includes("healthcare")).toBe(true);
    expect(lower.includes("financial records") || lower.includes("finance")).toBe(true);
    expect(lower.includes("employee") || lower.includes("hr")).toBe(true);
    expect(lower.includes("saas")).toBe(true);
    expect(lower.includes("student") || lower.includes("education")).toBe(true);
    expect(lower.includes("legal") || lower.includes("client")).toBe(true);
    expect(lower.includes("government") || lower.includes("citizen")).toBe(true);
    expect(lower.includes("customer-support") || lower.includes("customer support")).toBe(true);
    expect(readme).toMatch(/not\s+healthcare-only|not healthcare-only|not a single industry/i);
    expect(lower).toMatch(/compliance depends|does not make an organization compliant/);
  });

  it("README does not claim product compliance or unrelated technologies", () => {
    const readme = readFileSync(join(root, "..", "..", "README.md"), "utf8");
    const lower = readme.toLowerCase();
    expect(lower).not.toMatch(/\bhipaa[\s-]*(compliant|certified)\b/);
    expect(lower).not.toMatch(/\bglba[\s-]*(compliant|certified)\b/);
    expect(lower).not.toMatch(/\bferpa[\s-]*(compliant|certified)\b/);
    expect(lower).not.toMatch(/\bgdpr[\s-]*(compliant|certified)\b/);
    expect(lower).not.toMatch(/\bsoc\s*2[\s-]*(compliant|certified)\b/);
    expect(lower).not.toMatch(/\bis\s+healthcare-only\b/);
    expect(lower).not.toMatch(/\bhealthcare-only\s+product\b/);
    expect(lower).not.toMatch(/\bthis\s+is\s+a\s+database\b/);
    expect(lower).not.toMatch(/\bthis\s+package\s+is\s+a\s+blockchain\b/);
    expect(lower).not.toMatch(/\bintelpacketpii\s+is\s+a\s+blockchain\b/);
    expect(lower).not.toMatch(/\bintelpacketpii\s+is\s+(a\s+)?token\s+vault\b/);
    expect(lower).not.toMatch(/\bintelpacketpii\s+is\s+(an?\s+)?ai[\s-]*(system|platform|product)\b/);
  });

  it("compliance-positioning.md states non-claims and lists example regimes without certifying", () => {
    const doc = readFileSync(join(root, "..", "..", "docs", "compliance-positioning.md"), "utf8");
    const d = doc.toLowerCase();
    expect(d.includes("does not make an organization compliant")).toBe(true);
    expect(d.includes("hipaa")).toBe(true);
    expect(d.includes("gdpr")).toBe(true);
    expect(d).not.toMatch(/we are (hipaa|gdpr|soc\s*2)\s+(compliant|certified)/);
  });

  it("industry-usage.md stays industry-agnostic", () => {
    const doc = readFileSync(join(root, "..", "..", "docs", "industry-usage.md"), "utf8");
    const d = doc.toLowerCase();
    expect(d.includes("healthcare")).toBe(true);
    expect(d.includes("finance") || d.includes("financial")).toBe(true);
    expect(d).not.toMatch(/\bhealthcare-only\b/);
  });
});
