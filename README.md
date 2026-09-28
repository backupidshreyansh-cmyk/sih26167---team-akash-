# SATQUERY AI
**Evidence-Driven Satellite Intelligence Workstation**  
*Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis (ISRO SIH-26167)*

---

## 1. Problem Statement
General-purpose Vision-Language Models (VLMs) hallucinate when answering questions about Earth Observation (EO) imagery. They frequently convert visual inferences into definitive assertions, invent coordinates, confuse optical reflections with structural features, and answer confidently even when essential spectral bands or temporal baselines are absent.

## 2. Solution: Evidence-First Satellite Intelligence
**SatQuery AI operates on a non-negotiable core principle: The system answers only when the required evidence is validated; otherwise, it abstains.**

Model confidence is strictly decoupled from evidence sufficiency. A high confidence rating from a language model never by itself produces a `VERIFIED` state.

```
USER QUERY + UPLOADED IMAGERY
      ↓
INPUT DISCOVERY & AUTOMATIC CLASSIFICATION
(Single optical, Multispectral GeoTIFF, SAR radar, Bi-temporal pair, or Optical+SAR)
      ↓
CLAIM DECOMPOSITION & EVIDENCE PLAN
      ↓
DETERMINISTIC REMOTE-SENSING PROCESSING
(Band statistics, Spectral indices, SAR speckle/backscatter moments, Affine/CRS checks)
      ↓
CONFOUNDER SCREENING & SELF-QUESTIONING
(Cloud/shadow, illumination shifts, resolution limits, sensor capabilities)
      ↓
POLICY-ENFORCED DECISION GATE
      ↓
VERIFIED | INCONCLUSIVE | EVIDENCE CONFLICT | NEEDS MORE DATA
```

---

## 3. Strict Decision States

| Decision State | Definition | Operational Behavior |
| :--- | :--- | :--- |
| **`VERIFIED`** | Required evidence exists, is valid, and no material contradiction remains. | Outputs evidence-backed answer with grounded measurements. |
| **`INCONCLUSIVE`** | Evidence exists but does not establish the requested claim (e.g. single image for temporal change, or missing spectral bands). | Explains what is observed, what cannot be established, and abstains from guessing. |
| **`EVIDENCE CONFLICT`** | Valid evidence sources or sensor modalities materially disagree (e.g. optical shows bright feature, but SAR radar backscatter shows zero return). | Explicitly reports the discrepancy rather than forcing agreement. |
| **`NEEDS MORE DATA`** | The system identifies the specific observation or modality required to answer reliably. | Highlights the missing observation and offers one-click search across official ISRO Bhoonidhi / MOSDAC catalogues. |

---

## 4. Supported Inputs & Ingestion
The system features a **single unified upload area** that automatically inspects and classifies observations:
* **Formats**: GeoTIFF (`.tif`, `.tiff`, `.geotiff`), PNG, JPEG.
* **Single Optical**: Scene description, infrastructure localization, land cover mapping.
* **Multispectral GeoTIFF**: Band metadata extraction (`geotiff.js`), CRS/EPSG resolution, affine transform, spectral index screening.
* **SAR Radar Data**: Single-channel microwave backscatter, VV/VH polarizations, speckle analysis.
* **Bi-Temporal Pairs**: Automated dimension alignment, pixel differencing, illumination check.
* **Optical + SAR Pairs**: Cross-modal complementary analysis (e.g. cloud penetration).

---

## 5. Remote-Sensing Evidence Engines

### A. Deterministic Engine (`server/analysis/deterministicEngine.ts`)
* Pixel moments: mean luminance, variance, contrast ratio, surface proxies.
* Vegetative & water shadow proxies.
* Confounder indicators: overexposure, cloud fraction, low contrast, illumination shifts.

### B. SAR Evidence Engine (`server/utils/sarProcessor.ts`)
* Radar backscatter moments (mean, stdDev, P5, P95).
* Speckle Equivalent Number of Looks (ENL) and severity classification.
* Specular low-return absorption vs double-bounce reflection indicators.

### C. Self-Questioning Engine (`server/agent/selfQuestioningEngine.ts`)
* Evaluates 6 internal falsification checks before accepting candidate claims.
* Screens against sensor limitations (e.g. refusing to calculate NDVI when the NIR band is missing).
* Rejects manufactured geographic coordinates on unreferenced imagery.

---

## 6. Model Providers & Specialist Architecture

| Component | Status | Role |
| :--- | :--- | :--- |
| **Gemini VLM** | **IMPLEMENTED** | High-level semantic reasoning and structured synthesis (Online mode). |
| **Local Ollama (Qwen3-VL)** | **IMPLEMENTED** | Air-gapped, zero-cloud private inference (Offline mode). |
| **Deterministic RS Engine** | **IMPLEMENTED** | Pixel math, GeoTIFF headers, affine bounds, and spectral proxies. |
| **ISRO Bhoonidhi / MOSDAC Connector** | **IMPLEMENTED** | Active catalogue discovery API (`/api/eo/search`) for missing evidence. |
| **Prithvi-EO-2.0 Specialist** | **OPTIONAL** | Interface defined (`server/providers/PrithviEOSpecialist.ts`). Connects to local checkpoint if weights are present; never fakes execution. |
| **BigEarthNet Evaluation** | **OPTIONAL** | Reference dataset for benchmarking and multi-modal alignment. |
| **Direct Raster Tile Streaming** | **PLANNED** | Planetary WMS/WMTS tile streaming with authenticated GIS servers. |

---

## 7. Known Limitations
1. **Uncalibrated Imagery**: For standard consumer formats (PNG, JPEG), geographic coordinates (latitude/longitude) cannot be computed; the system explicitly bounds grounding to normalized pixel coordinates $[0, 1000]$.
2. **Spectral Indices**: NDVI or NDWI cannot be calculated without genuine Near-Infrared (NIR) or Shortwave-Infrared (SWIR) bands.
3. **Temporal Claims**: Single observations cannot establish whether construction or land-use change occurred.
4. **Catalogue Ingestion**: While Bhoonidhi and MOSDAC metadata discovery is live, automated bulk downloading of restricted sub-5m products requires user credentials under Indian Space Policy 2023.

---

## 8. Automated Verification & Testing

The test suite covers 57 deterministic and orchestrator checks across 9 test files:
```bash
npm test
```
* `tests/analysis_engine.test.ts`: Decision gating, tripartite separation, confidence decoupling.
* `tests/grounding.test.ts`: Normalized coordinate bounding, rejection of degenerate boxes.
* `tests/orchestrator.test.ts`: Query decomposition and agent tool selection.
* `tests/providers.test.ts`: Online/offline provider abstraction and graceful fallbacks.
* `tests/registry.test.ts`: Tool registration and schema validation.
* `tests/remote_sensing_evidence_engine.test.ts`: Level-0 deterministic queries, spectral band checks.
* `tests/safe_image_reader.test.ts`: Sanitization, corrupt header handling, buffer protection.
* `tests/sar_workflow.test.ts`: SAR speckle, ENL calculations, and polarization metadata.
* `tests/workflows_and_reporting.test.ts`: Markdown audit report generation and telemetry.

---

## 9. Running Locally

### Prerequisites
* Node.js v20+ or v22+
* npm

### Quick Start
```bash
# 1. Clone repository
git clone <repo_url>
cd satquery-ai

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Set GEMINI_API_KEY for online mode, or leave blank to use local Ollama

# 4. Run development server (Vite + Express on port 3000)
npm run dev

# 5. Type-check and run tests
npm run lint
npm test

# 6. Build production package
npm run build
npm start
```
