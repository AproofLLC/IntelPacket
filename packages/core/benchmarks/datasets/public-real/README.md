# Public-real benchmark datasets

These datasets are public-safe benchmark fixtures for the IntelPacket core advanced benchmark. They are intentionally small seed corpora that the runner repeats deterministically to the requested benchmark scale.

No file contains secrets, credentials, private enterprise data, real PII, or copied production dumps. Payloads are generated safe subsets inspired by public documentation shapes and common infrastructure event formats.

| Dataset | Purpose | Source type | Sanitization notes | License/source reference | Why selected |
| --- | --- | --- | --- | --- | --- |
| `github-api.json` | API response and webhook-like issue/repo payloads | Generated safe subset inspired by public GitHub REST examples | Reserved/example identifiers only; no real users or tokens | Generated fixture; public docs shape reference: GitHub REST API documentation | Exercises nested API objects, URLs, labels, actors, and arrays |
| `kubernetes-events.json` | Kubernetes event records | Generated safe subset inspired by Kubernetes event object examples | Synthetic namespaces, pods, UIDs, and messages | Generated fixture; public docs shape reference: Kubernetes API concepts/events | Exercises repetitive operational telemetry with nested involved objects |
| `otel-public-traces.json` | OpenTelemetry trace-like spans | Generated safe subset inspired by OpenTelemetry semantic conventions/examples | Synthetic trace IDs, span IDs, service names, and attributes | Generated fixture; public docs shape reference: OpenTelemetry specification examples | Exercises trace/span arrays, attributes, timing fields, and status objects |
| `cloud-audit-samples.json` | Cloud audit log shapes | Generated safe subset inspired by public cloud audit examples | Synthetic principals, projects, resources, and IP-like reserved test ranges | Generated fixture; public docs shape reference: public cloud audit log documentation patterns | Exercises security/audit event envelopes and repeated metadata |
| `webhook-events.json` | Generic SaaS webhook events | Generated safe subset inspired by public webhook documentation examples | Reserved domains and synthetic IDs only | Generated fixture; public webhook documentation shape patterns | Exercises event envelopes, delivery metadata, and nested payloads |
| `blockchain-transactions.json` | Public transaction-shaped records | Generated safe subset, not copied from any chain dump | Fake hex addresses and transaction hashes only | Generated fixture; no external chain data | Exercises high-cardinality transaction fields and arrays |
| `config-snapshots-public.json` | Public-safe configuration snapshots | Generated safe subset inspired by open-source app/config examples | Placeholder hosts, feature flags, and test endpoints only | Generated fixture; generic open-source config pattern | Exercises nested configuration trees and repeated service settings |

Public-real datasets matter because they include more realistic infrastructure shapes than pure entropy-class synthetic data. They still are not identical to private production traffic, and benchmark behavior remains workload-dependent.
