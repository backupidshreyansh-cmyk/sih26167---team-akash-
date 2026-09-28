# SatQuery AI - Team Contributions

**Organization**: ISRO / Department of Space
**Theme**: Space Technology
**Problem Statement**: SIH-26167

This section explicitly documents the responsibilities and contributions of the `team-akash` members in developing the SatQuery AI prototype.

## Contributions by Discipline

1. **System Architecture / Orchestration**
   - Designed the `Orchestrator` to automatically route incoming multimodal queries to the most cost-effective and capable specialist module.
   - Built the fallback handling logic to ensure graceful degradation.

2. **Frontend / UX**
   - Developed the React/Vite interface explicitly focused on SIH judging criteria (Evidence Cards, Falsifiability panels, bounding-box overlays).
   - Designed the Judge Mode and single-click compliance self-test.

3. **Remote-Sensing Processing**
   - Implemented deterministic GeoTIFF processing (bounds, EPSG, CRS parsing).
   - Built the spatial grounding validation engine that rejects impossible BBox coordinates.

4. **AI / Model Integration**
   - Integrated both Gemini (Online) and Ollama/Qwen (Offline).
   - Built the strict TypeScript schemas forcing the AI to output parsed `ConfidenceAssessment` and `Evidence` graphs.

5. **Dataset / Adaptation**
   - Constructed the Python-based LoRA/PEFT training pipeline scaffolds referencing `BigEarthNet.txt`.
   - Engineered the offline testing pipeline for Qwen3-VL parameters.

6. **Testing / Deployment / Documentation**
   - Maintained 100% CI/CD pipeline pass rate via Vitest and TS linting.
   - Authored the comprehensive SIH compliance runbooks and execution trace architecture.
