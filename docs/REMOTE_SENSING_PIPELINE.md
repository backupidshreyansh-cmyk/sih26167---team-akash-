# Remote Sensing Pipeline Architecture

The ORBITAL EYE orchestrator conceptually maps the complex, ambiguous task of remote-sensing analysis into deterministic steps.

## The Logical Pipeline

1. **Input Validation**
   - Receives N images (Max 2 for Bi-Temporal or Cross-Modal).
   - Detects MIME types (JPEG, PNG, TIFF).
2. **Modality Detection**
   - Automatically determines if the task is Single-Image VQA, Optical-SAR coregistration, or Temporal Change Analysis based on payload structure.
3. **Query Understanding**
   - Processes the user's natural language input alongside the strict SIH 26167 operational constraints (e.g. "Do not hallucinate coordinates").
4. **Tool/Model Selection**
   - Evaluates `aiMode`. If `AUTO`, attempts Cloud. If Cloud is unreachable, seamlessly routes the entire multimodal payload to the Edge/Local model.
5. **Observation vs Interpretation (Evidence Aggregation)**
   - The VLM is instructed to physically separate raw observed features ("A dark rectangular polygon") from its interpretation ("Likely an agricultural field").
6. **Confidence Estimation**
   - The engine produces a calibrated confidence score (`HIGH`, `LOW`, `CONFLICTING EVIDENCE`).
7. **Report Generation**
   - The final output is aggregated into an auditable JSON schema, mapping directly into the UI components and downloadable text reports.

This separation of concerns guarantees that AI hallucinations are caught in the `limitations` and `confidence` parameters rather than being presented as unquestionable facts.
