# Industry usage

IntelPacketPII applies the **same policy engine** everywhere the payload is **structured** and may carry **PII or sensitive attributes**.

## When to use it

Run **`protectPII`** (or **`createPIIPacket`**) before `createPacket` when data might include:

| Domain | Example sensitive concepts |
|--------|----------------------------|
| Healthcare | patient identifiers, clinical encounter records |
| Finance | accounts, cards, tax identifiers, routing/IBAN |
| HR / payroll | employee IDs, payroll IDs, compensation (when you mark fields sensitive) |
| SaaS | user profile PII, contact channels |
| Education | student IDs, guardian contacts |
| Legal | client names, matter references (configure non-standard names via detector extensions) |
| Government / citizen | national/tax identifiers, program eligibility fields |
| Support / CRM | ticket contact data, free-form narratives |
| Logistics / marketplaces | ship-to PII, buyer/seller contact fields |

## Policy design pattern

1. **Inventory** fields that may leave a trust boundary.  
2. Choose **actions** per field (redact, mask, tokenize, HMAC, remove).  
3. Use **`allow`** to explicitly enumerate outputs you intend to retain when shrinking records.  
4. Use **`deny`** for fields that must never pass raw (unstructured notes, paste buffers, etc.).  
5. Use **`detectOptions.sensitiveFieldNames`** for domain vocabularies not covered by built-in hints.  

## Operational fields

Generic **`user_id`**, **`record_id`**, or **`timestamp`** values are not automatically treated as PII unless your map or policy says so—avoid over-blocking operational telemetry.

## Failure modes

- **Fail-closed** (default): unhandled sensitive detections or residual patterns block the pipeline with `IntelPacketPIIError`.  
- **Permissive**: records issues on the report; combine with downstream guards if you use this in non-production paths.

## Further reading

- [privacy-policy.md](./privacy-policy.md)  
- [compliance-positioning.md](./compliance-positioning.md)  
