import { createPacket, replayPacket, verifyIntelPacket } from "@intelpacket/core";

const input = {
  user_id: "u1",
  amount: "49.990",
  currency: "EUR",
  request_id: "req-abc",
};

const packet = createPacket(input, { metadata: { labels: ["demo"] } });

console.log("verify before replay", verifyIntelPacket(packet));

const state = replayPacket(packet);

console.log("expanded (verbose keys)", JSON.stringify(state.expanded, null, 2));
console.log("compacted layer keys (short)", JSON.stringify(state.compacted, null, 2));
