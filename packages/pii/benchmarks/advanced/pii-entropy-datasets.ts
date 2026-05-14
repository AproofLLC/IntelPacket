/**
 * Deterministic synthetic PII-shaped user rows (fake data only).
 */

export type EntropyClass = "low" | "medium" | "high" | "nested-low" | "nested-high";

export const ENTROPY_ORDER: readonly EntropyClass[] = [
  "low",
  "medium",
  "high",
  "nested-low",
  "nested-high",
] as const;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(rng: () => number, len: number): string {
  let s = "";
  while (s.length < len) {
    s += Math.floor(rng() * 16).toString(16);
  }
  return s.slice(0, len);
}

export function buildPiiUsers(
  entropy: EntropyClass,
  scale: number,
  seed: number,
): { users: Record<string, unknown>[]; bannedLiterals: string[] } {
  const rng = mulberry32(seed);
  const users: Record<string, unknown>[] = [];
  const banned = new Set<string>();

  for (let i = 0; i < scale; i++) {
    let email: string;
    let phone: string;
    let national_id: string;
    let legal_name: string;
    let addr_line: string;

    switch (entropy) {
      case "low":
        email = `bench.user.${i % 20}@example.invalid`;
        phone = `555-0100-${String(i % 1000).padStart(4, "0")}`;
        national_id = `SYN-LOW-${String(i % 500).padStart(6, "0")}`;
        legal_name = `Fake Person ${i % 10}`;
        addr_line = `${i % 5} Synthetic St`;
        break;
      case "medium":
        email = `bench.user.${(i * 17 + seed) % 800}@test.invalid`;
        phone = `555-02${String(i % 100).padStart(2, "0")}-${String(2000 + (i % 8000)).padStart(4, "0")}`;
        national_id = `SYN-MED-${String((i * 11) % 100000).padStart(6, "0")}`;
        legal_name = `Fake Person ${(i * 3) % 200}`;
        addr_line = `${(i * 7) % 200} Fictional Ave`;
        break;
      case "high":
        email = `u-${hex(rng, 8)}-${i}@example.invalid`;
        phone = `555-${hex(rng, 3)}-${hex(rng, 4)}`;
        national_id = `SYN-HI-${hex(rng, 12)}`;
        legal_name = `Person ${hex(rng, 6)}`;
        addr_line = `${hex(rng, 4)} Random Rd`;
        break;
      case "nested-low":
        email = `nested.low.${i % 30}@example.invalid`;
        phone = `555-0300-${String(i % 900).padStart(4, "0")}`;
        national_id = `SYN-NL-${String(i % 400).padStart(5, "0")}`;
        legal_name = `Sameish Name ${i % 8}`;
        addr_line = "1 Bench Loop";
        break;
      case "nested-high":
        email = `nested.hi.${hex(rng, 6)}@test.invalid`;
        phone = `555-04${String(i % 99).padStart(2, "0")}-${hex(rng, 4)}`;
        national_id = `SYN-NH-${hex(rng, 10)}`;
        legal_name = `Unique ${hex(rng, 8)}`;
        addr_line = `${hex(rng, 3)} Chaos Ct`;
        break;
      default: {
        const _e: never = entropy;
        throw new Error(`unknown ${_e}`);
      }
    }

    banned.add(email);
    banned.add(phone);
    banned.add(national_id);
    banned.add(legal_name);
    banned.add(addr_line);

    users.push({
      idx: i,
      email,
      phone,
      national_id,
      legal_name,
      addr_line,
      tier: i % 4,
    });
  }

  return { users, bannedLiterals: [...banned] };
}
