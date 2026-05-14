import { canonicalStringify, createPacket, replayPacket } from "@intelpacket/pii";

const template = { host: "edge-1", region: "us-west" };

const batch = Array.from({ length: 200 }, (_, i) => ({
  event_type: i % 2 === 0 ? "tick" : "tock",
  temperature: 20 + (i % 3),
  device_id: `d-${i % 5}`,
  metadata: template,
}));

const packet = createPacket(batch, {
  metadata: { title: "telemetry-batch" },
});

console.log("rows", batch.length);
console.log("compression", packet.compression);
console.log(
  "reduction vs raw JSON utf8",
  `${(packet.compression.reduction_ratio * 100).toFixed(2)}%`,
);

const jsonBytes = Buffer.byteLength(JSON.stringify(batch), "utf8");
console.log("raw JSON bytes", jsonBytes);
console.log("compressed bytes", packet.compression.compressed_bytes);

const state = replayPacket(packet);
console.log("replayed array length", (state.expanded as unknown[]).length);
console.log("canonical head", canonicalStringify((state.expanded as unknown[])[0]));
