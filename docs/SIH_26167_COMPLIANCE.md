# SIH-26167 Compliance Engine

SatQuery AI has been designed strictly to meet the problem statement **SIH-26167**:
"An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries."

## Coverage Matrix

### 1. Modality Support
- **Optical/Multispectral**: Yes. Handled via `OpticalAnalysisTool` and deterministic metadata analysis.
- **Synthetic Aperture Radar (SAR)**: Yes. Handled via `SarAnalysisTool` ensuring intensity/backscatter structures are accurately described.
- **Cross-Modal**: Yes. Supported through `CrossModalArbitratorTool` which validates if independent Optical and SAR assessments agree.

### 2. Analytical Capabilities
- **Single-Image VQA**: Yes. Addressed using model capabilities via `VisualVQATool`.
- **Image Captioning & Scene Description**: Yes.
- **Text-Guided Object Grounding**: Yes. Implemented through the `SpatialReasoningTool`. Normalizes output coordinates to standard bounds (0-1000 or fractional).
- **Bi-Temporal Analysis**: Yes. Orchestrator detects `BEFORE` and `AFTER` images and utilizes `TemporalAnalysisTool` to verify change evidence.

### 3. File Formats
- **GeoTIFF/TIFF**: Yes. Dedicated ingestion engine (`metadata.ts`) extracts bounds, CRS, dimensions, and performs Jimp/Buffer normalization to compress inputs for VLM inference.
- **JPEG/PNG**: Yes. Standard supported formats.

### 4. Agentic Execution & Automation
- **Automatic Resource Discovery**: System inspects supplied metadata prior to deciding on a model execution path.
- **Tool Selection (Registry)**: System selects minimum-sufficient tools.
- **Confidence Calibration**: The engine demands explicit limitations, preventing hallucinated 99% accuracy estimates.

### 5. Final Report Generation
- **Downloadable Reports**: Real-time generation of analysis reports with model-route traces, execution cost, and evidence breakdown.
