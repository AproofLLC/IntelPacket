import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalStringify,
  canonicalize,
  createPacket,
  normalizeTypes,
  replayPacket,
  IP_VERSION,
  INTELPACKET_SPEC_VERSION,
} from "../packages/core/src/index.ts";
import {
  createPIIPacket,
  protectPII,
  validatePrivacyPolicy,
} from "../packages/pii/src/index.ts";

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, "..");
const fixedCreatedAt = "2026-01-01T00:00:00.000Z";

const coreInputs = [
  {
    name: "flat object with shuffled keys",
    input: { zeta: true, alpha: "A", count: 3, beta: null },
  },
  {
    name: "nested object",
    input: {
      event_type: "login",
      metadata: { region: "us-test-1", device: { os: "test-os", version: "1.0" } },
      user_id: "user-0001",
    },
  },
  {
    name: "repeated structures for dedupe",
    input: {
      rows: [
        { kind: "metric", values: [1, 2, 3], metadata: { host: "h1" } },
        { kind: "metric", values: [1, 2, 3], metadata: { host: "h1" } },
        { kind: "metric", values: [1, 2, 3], metadata: { host: "h1" } },
      ],
    },
  },
  {
    name: "array order sensitivity",
    input: { ordered: ["first", "second", "third"], weights: [3, 2, 1] },
  },
  {
    name: "numeric string date normalization case",
    input: {
      amount: 123.45,
      amount_text: "123.45",
      active: false,
      created_at: "2026-01-01T12:34:56.789Z",
    },
  },
];

const coreVectors = coreInputs.map((v) => {
  const options = { createdAt: fixedCreatedAt, disableCompression: true };
  const packet = createPacket(v.input, options);
  const expectedCanonicalString = canonicalStringify(canonicalize(normalizeTypes(v.input)));
  return {
    name: v.name,
    input: normalizeTypes(v.input),
    options,
    expectedCanonicalString,
    expectedPacketHash: packet.packet_hash,
    expectedSpecVersion: INTELPACKET_SPEC_VERSION,
    expectedIpVersion: IP_VERSION,
    expectedReplayCanonical: canonicalStringify(replayPacket(packet).canonical),
  };
});

const coreOut = join(repo, "packages/core/tests/fixtures/golden/core-golden-vectors.json");
mkdirSync(dirname(coreOut), { recursive: true });
writeFileSync(coreOut, `${JSON.stringify(coreVectors, null, 2)}\n`, "utf8");

const tokenSecret = "golden-token-secret-never-leak-32";
const hmacSecret = "golden-hmac-secret-never-leak-32!";
const piiPolicy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  redact: ["ssn", "internal_note"],
  mask: ["phone"],
  tokenize: ["email", "account_id"],
  hmac: ["legal_name"],
  allow: ["id", "email", "account_id", "legal_name", "phone", "ssn", "internal_note", "role"],
});
const piiInput = {
  id: "fixture-1",
  email: "fixture.user@example.invalid",
  account_id: "acct_fixture_001",
  legal_name: "Fixture User",
  phone: "555-010-9999",
  ssn: "123-45-6789",
  internal_note: "synthetic private note",
  role: "tester",
};
const protectedPii = protectPII(piiInput, piiPolicy, { tokenSecret, hmacSecret });
const piiPacket = createPIIPacket(piiInput, piiPolicy, {
  tokenSecret,
  hmacSecret,
  packetOptions: { createdAt: fixedCreatedAt, disableCompression: true },
});
const piiVectors = [
  {
    name: "policy-covered fake pii packet",
    input: piiInput,
    policy: piiPolicy,
    expectedProtectedData: protectedPii.data,
    expectedPrivacyReport: protectedPii.report,
    expectedPacketHash: piiPacket.packet.packet_hash,
    expectedSpecVersion: INTELPACKET_SPEC_VERSION,
    expectedIpVersion: IP_VERSION,
  },
];
const piiOut = join(repo, "packages/pii/tests/fixtures/golden/pii-golden-vectors.json");
mkdirSync(dirname(piiOut), { recursive: true });
writeFileSync(piiOut, `${JSON.stringify(piiVectors, null, 2)}\n`, "utf8");

console.log(`Wrote ${coreOut}`);
console.log(`Wrote ${piiOut}`);
