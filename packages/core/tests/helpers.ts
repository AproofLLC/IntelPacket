import { canonicalStringify, canonicalize, normalizeTypes } from "../src/index.js";
import type { PacketMetadata } from "../src/types.js";

/** Canonical JSON after normalize — replayed `state.canonical` must match this (verbose keys). */
export function expectedReplayCanonical(
  input: unknown,
  _metadata?: PacketMetadata,
): unknown {
  void _metadata;
  const n = normalizeTypes(input);
  return canonicalize(n);
}

export function assertReplayCanonical(replayCanonical: unknown, input: unknown): void {
  const a = canonicalStringify(replayCanonical);
  const b = canonicalStringify(expectedReplayCanonical(input));
  if (a !== b) {
    throw new Error(`Replay canonical mismatch.\nGot: ${a}\nExp: ${b}`);
  }
}
