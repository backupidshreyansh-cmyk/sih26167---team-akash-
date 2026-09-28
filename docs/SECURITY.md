# Security Architecture

## Zero Trust LLM Execution
The LLM acts as an analysis engine, **not an executor**. 
- It does **not** have shell execution capability.
- It does **not** have direct database or filesystem read/write access.
- Tools are sandboxed within strict TypeScript registries with validated arguments.

## Input Validation
- **Size Limits**: Express backend rejects payloads exceeding 50MB.
- **Mime Validation**: All images must contain verifiable binary signatures.
- **GeoTIFF Integrity**: Subsampled buffer limits ensure malicious TIFF structures do not trigger Out-of-Memory (OOM) errors during metadata parsing.

## Prompt Injection Defense
- System instructions strictly isolate User Query from Image content.
- `metadata.ts` strips out unrecognized tags preventing payload injection via TIFF metadata tags.
