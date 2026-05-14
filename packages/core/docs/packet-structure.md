# Packet structure (outer)

An `IntelPacket` is the on-wire wrapper around a compressed inner JSON envelope.

## Fields

| Field | Role |
|--------|------|
| `ip_version` | Protocol version string (e.g. `"1"`). |
| `packet_id` | First 16 hex chars of `packet_hash`. |
| `packet_hash` | SHA-256 of the canonical **inner** envelope (see below). |
| `created_at` | ISO timestamp for storage/display; **excluded** hash input. |
| `encoding` | `"canonical-json"` for the inner document. |
| `compression` | `method`, `raw_bytes`, `compressed_bytes`, `reduction_ratio`. |
| `payload` | Base64-encoded compressed UTF-8 inner JSON. |
| `refs` | Non-authoritative mirror of the inner dedupe table (replay uses **inner** `refs` only). |
| `delta` | When `options.base` is set: deterministic patch metadata for audit/diff workflows; inner envelope still holds the **full** next state. Delta-only packets are not a v0.1 mode. |
| `metadata` | Caller data; `compaction_dictionary` affects replay expansion. |

## Inner envelope (inside `payload`, after decompress)

```json
{
  "ip_version": "1",
  "encoding": "canonical-json",
  "root": { },
  "refs": { "r0": { } },
  "delta": null
}
```

`root` may contain `{ "__ip_ref": "r0" }` nodes that are expanded during `replayPacket` using `refs`.

Only this inner object (canonicalized) is hashed into `packet_hash`.
