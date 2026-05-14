import { describe, expect, it } from "vitest";
import { createPacket, replayPacket, verifyIntelPacket } from "../../src/index.js";

describe("integrity schema drift", () => {
  const versions = [
    { version: "v1", data: { user_id: "u-1", status: "active", roles: ["reader"] } },
    { version: "v2", data: { user_id: "u-1", status: "active", roles: ["reader"], device: "test-device", region: "test-region" } },
    {
      version: "v3",
      data: { user_id: "u-1", status: "active", account_status: "active", roles: ["reader"] },
      metadata: { title: "schema v3 preserves old status in payload" },
    },
    {
      version: "v4",
      data: {
        user_id: "u-1",
        account_status: "active",
        roles: ["reader"],
        permissions: { projects: { read: true, write: false }, audit: ["view"] },
      },
    },
    { version: "v5", data: { user_id: "u-1", account_status: "active", roles: [] } },
  ];

  it("keeps each enterprise schema version replayable and deterministic", () => {
    const hashes = new Set<string>();
    for (const item of versions) {
      const options = {
        createdAt: "2026-01-01T00:00:00.000Z",
        disableCompression: true,
        metadata: item.metadata,
      };
      const packet = createPacket(item.data, options);
      const packetAgain = createPacket(item.data, options);
      expect(packetAgain.packet_hash).toBe(packet.packet_hash);
      expect(verifyIntelPacket(packet)).toBe(true);
      expect(replayPacket(packet).normalized).toEqual(item.data);
      hashes.add(packet.packet_hash);
    }
    expect(hashes.size).toBe(versions.length);
  });

  it("passes lineage metadata through without changing logical replay", () => {
    const data = versions[2]!.data;
    const withoutLineage = createPacket(data, { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true });
    const withLineage = createPacket(data, {
      createdAt: "2026-01-01T00:00:00.000Z",
      disableCompression: true,
      metadata: { title: "lineage:v2->v3" },
    });
    expect(withLineage.metadata.title).toBe("lineage:v2->v3");
    expect(withLineage.packet_hash).toBe(withoutLineage.packet_hash);
    expect(replayPacket(withLineage).canonical).toEqual(replayPacket(withoutLineage).canonical);
  });
});
