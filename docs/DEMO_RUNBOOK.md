# SIH 2026 - Demo Runbook

## Setup Requirements
1. Node.js (v20+)
2. Install dependencies: `npm install`
3. Environment variables: `cp .env.example .env` and populate `GEMINI_API_KEY`.
4. (Optional) Ollama running locally for offline features.

## Start the Application
```bash
npm run build
npm run start
```
Or for development:
```bash
npm run dev
```

## Recommended Demo Sequence

### Demo 1: Scene Description & VQA
1. Upload a sample Optical PNG or GeoTIFF.
2. Query: "What land-cover characteristics are visible?"
3. Outcome: System categorizes as `SCENE_DESCRIPTION`, extracts metadata, selects `VisualVQATool`, and outputs localized evidence.

### Demo 2: Cross-Modal Verification
1. Upload an Optical image AND its corresponding SAR counterpart.
2. Select "Auto" mode.
3. Query: "What complementary evidence do optical and SAR observations provide regarding the coastal structure?"
4. Outcome: System routes to both `OpticalAnalysisTool` and `SarAnalysisTool`, then synthesizes via `CrossModalArbitratorTool`. Disagreements are surfaced.

### Demo 3: Bi-Temporal Change Detection
1. Upload Before and After images.
2. Query: "Did the observed area change between the two observations?"
3. Outcome: System invokes `TemporalAnalysisTool`. Evidence planner isolates observed changes vs. interpreted consequences.

### Demo 4: System Audit
1. Click the green "SIH Compliance & Self-Test" button.
2. Run the audit to prove local tool registry, model connectivity, and architectural compliance.
