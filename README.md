# SATQUERY AI
**Semantic Retrieval & Multi-Temporal Change Analysis Workstation (SIH 2026 PS 26227 / SIH-26167)**  
*On-Premises, Evidence-First Satellite Archive Intelligence Platform*

---

## 1. Problem Statement Overview (ISRO SIH 2026 PS 26227)
Modern satellite archives ingest terabytes of multi-sensor Earth-Observation imagery daily. Analysts require the ability to:
1. Search archives using natural-language semantic concepts without manually specifying complex metadata.
2. Detect and track multi-temporal changes across chronological observation epochs.
3. Suppress false alarms caused by seasonal variation, sensor differences, and registration misalignment.
4. Discover similar sites across wide areas without writing new queries for every location.
5. Review evidence-backed candidates with complete provenance and human-in-the-loop audit trails.
6. Operate 100% offline in sovereign, network-isolated environments on laptop hardware (e.g. AMD Ryzen 7 / NVIDIA RTX 4050 / 24 GB RAM).

SatQuery AI provides an end-to-end, scientifically decoupled solution strictly adhering to these requirements.

---

## 2. Core Architecture Pipeline
```
SATELLITE RASTER / ARCHIVE
            ↓
LOCAL ARCHIVE INGESTION (Phase 1)
(Validation → Stable Scene ID → Deterministic SHA-256 → Catalog Metadata)
            ↓
LOCAL EMBEDDING & VECTOR INDEX (Phase 2)
(512-D L2-Normalized Visual/Text Vectors → O(1) Incremental Addition)
            ↓
SEMANTIC SATELLITE RETRIEVAL (Phase 3)
(Query Understanding → Pre-Filtering → Cosine Search → Explainable Reranking)
            ↓
MULTI-TEMPORAL CHANGE ANALYSIS (Phase 4)
(Temporal Series Collection → Sub-pixel Co-Registration → Region Differencing)
            ↓
FALSE-ALARM SUPPRESSION (Phase 5)
(Seasonality Screening → Spatial Coherence Check → Persistence Validation)
            ↓
SIMILAR-SITE DISCOVERY & CLUSTERING (Phase 6)
(Reference Vector → Spatial Deduplication → Spherical K-Means / Medoids)
            ↓
ANALYST REVIEW WORKSPACE & PROVENANCE (Phase 7)
(Review Queue → Confirm / Reject / Uncertain → Scoped Feedback → Audit Trail)
            ↓
OFFLINE HARDENING & BENCHMARKS (Phase 8)
(Zero External Network Calls → Hardware Safety → Reproducible Latencies)
```

---

## 3. The 4 Evaluator Demo Scenarios

### Scenario 1: Semantic Discovery
* **Query**: `"Find built-up areas near rivers."`
* **Workflow**: Natural language query → Query understanding extracts target phenomenon ("built-up") and spatial relation ("near rivers") → Pre-filters catalog → Searches 512-D vector index → Reranks candidates transparently.
* **Result**: Ranked observations with similarity metrics, matching filters, and exact reasons for retrieval.

### Scenario 2: Multi-Temporal Change Detection
* **Query**: `"Find new construction between 2022 and 2024."`
* **Workflow**: Identifies candidate locations with multiple chronological observations → Assesses co-registration quality → Computes normalized radiometric differencing → Identifies coherent spatial change regions → Verifies earliest supported transformation epoch.
* **Result**: Side-by-side / curtain wipe before-after evidence, changed pixel extent (14.8%), and decision state: `SUPPORTED_CHANGE`.

### Scenario 3: Similar-Site Discovery & Clustering
* **Workflow**: Analyst opens a site of interest (e.g., Krishna River infrastructure) → Clicks **[FIND MORE LIKE THIS]** → Vector search retrieves top-K candidates → Spatial deduplication suppresses overlapping tiles → Spherical K-Means groups sites into semantic clusters → Identifies Medoid cluster representatives.
* **Scientific Decoupling**: Visual similarity does NOT automatically claim identical temporal change; the analyst can click **[VERIFY CHANGE]** to test temporal hypotheses on any discovered site.

### Scenario 4: False-Alarm & Uncertainty Suppression
* **Workflow**: Evaluator tests a seasonal vegetation flush or wet/dry cycle transition.
* **Result**: The system detects high seasonal variance (`SEASONAL_DIFFERENCE: HIGH`) and suppresses overconfident assertions, classifying the observation as `LIKELY_SEASONAL_VARIATION` or `INSUFFICIENT_EVIDENCE` rather than false construction.

---

## 4. PS 26227 Verification & Compliance Matrix

| PS 26227 Capability | Status | Implementation Component | Test Verification |
| :--- | :--- | :--- | :--- |
| **2.2.1 Semantic Retrieval** | **PASS** | `SemanticSearchService`, `QueryParser`, `LocalVectorIndex` | `tests/archive_ingestion.test.ts`, `tests/offline_evaluation_benchmark.test.ts` |
| **2.2.2 Multi-Temporal Change** | **PASS** | `ChangeDetectionEngine`, `EarliestChangeDetector`, `TemporalGrouping` | `tests/workflows_and_reporting.test.ts` |
| **2.2.3 False-Alarm Suppression** | **PASS** | `QualityAssessmentEngine`, `FalseAlarmDecisionEngine` | `tests/visual_vs_change_intent_regression.test.ts` |
| **2.2.4 Discovery & Clustering** | **PASS** | `SimilarSiteService`, `ClusteringEngine` (Spherical K-Means / Medoid) | `tests/discovery_and_clustering.test.ts` |
| **2.2.5 Analyst Workflow & Provenance** | **PASS** | `ReviewQueueService`, `FeedbackStore`, `FeedbackReranker`, `ExportService` | `tests/analyst_review_workflow.test.ts` |
| **2.2.6 Incremental Ingestion** | **PASS** | `IngestionEngine`, `CatalogService`, `GeoreferencingEngine` | `tests/archive_ingestion.test.ts` (O(1) duplicate skipping) |
| **2.2.7 Offline Operation** | **PASS** | `EvaluationEngine`, 100% Local Embeddings & In-Memory Indices | `tests/offline_evaluation_benchmark.test.ts` (0 external calls) |

---

## 5. Local Hardware & Resource Profile
* **Target Hardware Profile**: AMD Ryzen 7 7435HS (8 Cores), NVIDIA RTX 4050 Laptop GPU (6 GB VRAM), 24 GB RAM.
* **Offline Execution**: Zero required external network calls; fully autonomous local operation once staged.
* **Tensor Safety**: Sequential processing with explicit vector normalization and cache controls. Peak memory usage during full search benchmark < 1.8 GB RAM.

---

## 6. How to Launch & Test

### Run Automated Test Suite (14 Suites, 97 Tests)
```bash
npm test
```

### Run Static Analysis / Linter
```bash
npm run lint
```

### Compile Applet Build
```bash
npm run build
```

### Launch Development Server (Port 3000)
```bash
npm run dev
```

*Open your browser at `http://localhost:3000` to interact with the workstation.*
