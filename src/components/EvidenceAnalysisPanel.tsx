import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  ShieldCheck, 
  AlertTriangle, 
  FileDown, 
  Cpu, 
  Crosshair, 
  Compass, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
  Search,
  Database,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { AgentResponse, UploadedImage } from '../types';

interface EvidenceAnalysisPanelProps {
  lastResponse?: AgentResponse;
  images: UploadedImage[];
  isLoading: boolean;
  runId: string;
  onDownloadReport: () => void;
}

export function EvidenceAnalysisPanel({
  lastResponse,
  images,
  isLoading,
  runId,
  onDownloadReport
}: EvidenceAnalysisPanelProps) {
  const [isSearchingEo, setIsSearchingEo] = useState(false);
  const [eoSearchResults, setEoSearchResults] = useState<any[] | null>(null);
  const [eoSearchError, setEoSearchError] = useState<string | null>(null);

  // Extract decision status strictly:
  // MODEL CONFIDENCE MUST NEVER BY ITSELF PRODUCE VERIFIED!
  const getDecisionStatus = (contractDecision?: string) => {
    const raw = (contractDecision || '').toUpperCase();
    if (raw === 'VERIFIED') {
      return {
        label: 'VERIFIED',
        bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
        badge: 'bg-emerald-500 text-slate-950 font-bold',
        description: 'Required evidence exists, is valid, and no material contradiction remains.'
      };
    }
    if (raw.includes('CONFLICT')) {
      return {
        label: 'EVIDENCE CONFLICT',
        bg: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
        badge: 'bg-rose-500 text-white font-bold',
        description: 'Valid evidence sources or sensor modalities materially disagree.'
      };
    }
    if (raw.includes('NEEDS_MORE') || raw.includes('MORE_DATA')) {
      return {
        label: 'NEEDS MORE DATA',
        bg: 'bg-blue-500/15 border-blue-500/40 text-blue-400',
        badge: 'bg-blue-500 text-slate-950 font-bold',
        description: 'The system identified missing evidence required to answer reliably without guessing.'
      };
    }
    return {
      label: 'INCONCLUSIVE',
      bg: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
      badge: 'bg-amber-500 text-slate-950 font-bold',
      description: 'Available evidence is insufficient to establish the claim without guessing.'
    };
  };

  const decision = getDecisionStatus(lastResponse?.contract?.finalDecision);

  // Dynamic recommendations for "What could change the decision"
  const getResolutionFactors = (): string[] => {
    if (!lastResponse) return [];
    const factors: string[] = [];
    const task = lastResponse.taskClassification;

    if (task === 'BI_TEMPORAL_ANALYSIS' || task === 'CHANGE_VQA') {
      factors.push('Co-registered pre-event and post-event satellite acquisitions.');
      factors.push('Normalizing solar elevation angle to eliminate differential cloud and terrain shadow.');
    }
    if (task === 'OPTICAL_SAR_ANALYSIS') {
      factors.push('Orthorectified Sentinel-1 GRD or RISAT-1A SAR scene in matching spatial projection.');
      factors.push('Dual-polarization (VV + VH) to differentiate volumetric canopy scatter from dielectric double-bounce.');
    }
    if (images.some(i => !i.metadata?.epsg && !i.metadata?.crs)) {
      factors.push('Authoritative GeoTIFF tags (ModelTiepoint / EPSG CRS) for physical ground coordinates.');
    }
    if (factors.length === 0) {
      factors.push('Calibrated spectral channels (NIR / SWIR) to compute physical vegetation or moisture indices.');
      factors.push('Higher spatial resolution (<10m GSD) to resolve sub-pixel structural boundaries.');
    }
    return factors;
  };

  const resolutionFactors = getResolutionFactors();

  // Decoupled Metrics (Model confidence is explicitly NOT evidence)
  const metrics = React.useMemo(() => {
    if (!lastResponse) return null;

    const dataQuality = images.some(i => i.metadata?.epsg || i.metadata?.crs)
      ? 'CALIBRATED CRS (Georeferenced)'
      : 'PIXEL SPACE (Visual Verification Only)';

    const evidenceSufficiency = lastResponse.contract?.evidenceSufficiency || 'INSUFFICIENT';

    const modelConfidence = lastResponse.contract?.modelConfidence 
      ? `${lastResponse.contract.modelConfidence} (Model Estimate)`
      : lastResponse.confidence?.level 
        ? `${lastResponse.confidence.level} (Model Estimate)`
        : 'MEDIUM (Model Estimate)';

    return {
      dataQuality,
      evidenceSufficiency,
      modelConfidence
    };
  }, [lastResponse, images]);

  // Handle active data discovery from Bhoonidhi / MOSDAC
  const handleDiscoverEoData = async () => {
    if (isSearchingEo) return;
    setIsSearchingEo(true);
    setEoSearchError(null);
    try {
      const res = await fetch('/api/eo/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: lastResponse?.contract?.query || 'Multimodal remote sensing satellite imagery',
          modality: lastResponse?.recommendedModality || 'OPTICAL'
        })
      });
      if (!res.ok) throw new Error(`Discovery failed with status ${res.status}`);
      const data = await res.json();
      setEoSearchResults(data.observations || []);
    } catch (err: any) {
      setEoSearchError(err.message || 'Unable to connect to EO catalogue service.');
    } finally {
      setIsSearchingEo(false);
    }
  };

  // Tripartite Separation data
  const observedAndMeasured = lastResponse?.contract?.observedAndMeasured?.length
    ? lastResponse.contract.observedAndMeasured
    : (lastResponse?.contract?.observations?.length
        ? lastResponse.contract.observations
        : lastResponse?.evidence?.observations || []);

  const inferred = lastResponse?.contract?.inferred?.length
    ? lastResponse.contract.inferred
    : (lastResponse?.contract?.supportingEvidence?.length
        ? lastResponse.contract.supportingEvidence
        : [lastResponse?.contract?.initialHypothesis || 'Candidate hypothesis from visual analysis']);

  const notEstablished = lastResponse?.contract?.notEstablished?.length
    ? lastResponse.contract.notEstablished
    : (lastResponse?.contract?.limitations?.length
        ? lastResponse.contract.limitations
        : ['Ground-truth confirmation without in-situ ground sensors cannot be established.']);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl select-none">
      
      {/* Header */}
      <div className="bg-slate-900/90 border-b border-slate-800 p-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck size={16} />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Evidence &amp; Decision Gate</h2>
            <p className="text-[10px] text-slate-400">Auditable Ground-Truth Verification</p>
          </div>
        </div>

        {lastResponse && (
          <button
            onClick={onDownloadReport}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg transition-colors cursor-pointer shadow-xs"
            title="Download auditable remote sensing report"
          >
            <FileDown size={13} />
            <span>Download Report</span>
          </button>
        )}
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Executing Agentic Pipeline</h3>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Extracting deterministic pixel moments, building evidence graph, and evaluating decision gate...
              </p>
            </div>
          </div>
        ) : !lastResponse ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <Compass size={36} className="opacity-30" />
            <h3 className="text-xs font-semibold text-slate-400">Awaiting Query Execution</h3>
            <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
              Execute a query to inspect the deterministic decision gate, supporting/contradicting evidence, and confounder challenges.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* 1. STRICT DECISION GATE BANNER */}
            <div className={`p-3.5 rounded-xl border ${decision.bg} shadow-md`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-80">
                  DECISION GATE
                </span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shadow ${decision.badge}`}>
                  {decision.label}
                </span>
              </div>
              <p className="text-xs font-medium leading-snug">
                {decision.description}
              </p>
            </div>

            {/* 2. PRIMARY NATURAL LANGUAGE ANSWER */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  PRIMARY SYNTHESIS ANSWER
                </span>
                <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {lastResponse.taskClassification}
                </span>
              </div>
              <div className="prose prose-sm prose-invert max-w-none text-slate-200 text-xs leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {lastResponse.answer}
                </ReactMarkdown>
              </div>
            </div>

            {/* 3. TRIPARTITE SEPARATION: OBSERVED vs INFERRED vs NOT ESTABLISHED */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-indigo-400" />
                  EVIDENCE BREAKDOWN (NO GUESSING)
                </span>
                <span className="text-[9px] font-mono text-slate-500">Source of Truth</span>
              </div>

              {/* A. OBSERVED / MEASURED */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  1. OBSERVED / MEASURED (Facts)
                </span>
                <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc marker:text-emerald-500">
                  {observedAndMeasured.slice(0, 4).map((obs: any, idx: number) => (
                    <li key={idx} className="leading-snug">{typeof obs === 'string' ? obs : obs.text}</li>
                  ))}
                </ul>
              </div>

              {/* B. INFERRED */}
              <div className="space-y-1 pt-1 border-t border-slate-900">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                  <Info size={12} />
                  2. INFERRED (Candidate Hypotheses)
                </span>
                <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc marker:text-sky-500">
                  {inferred.slice(0, 3).map((inf: string, idx: number) => (
                    <li key={idx} className="leading-snug">{inf}</li>
                  ))}
                </ul>
              </div>

              {/* C. NOT ESTABLISHED */}
              <div className="space-y-1 pt-1 border-t border-slate-900">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle size={12} />
                  3. NOT ESTABLISHED (Cannot Prove from Data)
                </span>
                <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc marker:text-amber-500">
                  {notEstablished.slice(0, 3).map((notEst: string, idx: number) => (
                    <li key={idx} className="leading-snug">{notEst}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 4. DECOUPLED METRICS: DATA QUALITY | EVIDENCE SUFFICIENCY | MODEL CONFIDENCE */}
            {metrics && (
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-0.5 font-bold uppercase">DATA QUALITY</span>
                  <span className="text-slate-200 font-semibold leading-tight block">{metrics.dataQuality}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-0.5 font-bold uppercase">EVIDENCE SUFFICIENCY</span>
                  <span className={`font-semibold block leading-tight ${
                    metrics.evidenceSufficiency === 'STRONG' || metrics.evidenceSufficiency === 'MODERATE'
                      ? 'text-emerald-400' 
                      : metrics.evidenceSufficiency === 'CONFLICTING'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                  }`}>
                    {metrics.evidenceSufficiency}
                  </span>
                  <span className="text-[8px] text-slate-500 block mt-0.5">Determines Gate</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-0.5 font-bold uppercase">MODEL CONFIDENCE</span>
                  <span className="text-cyan-400 font-semibold block leading-tight">{metrics.modelConfidence}</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5">Not Evidence</span>
                </div>
              </div>
            )}

            {/* 5. MISSING EVIDENCE & ACTIVE ACQUISITION (When decision is NEEDS MORE DATA or INCONCLUSIVE) */}
            {(decision.label === 'NEEDS MORE DATA' || decision.label === 'INCONCLUSIVE' || lastResponse.contract?.whyNotVerified) && (
              <div className="bg-blue-950/20 border border-blue-900/50 p-3.5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between border-b border-blue-900/40 pb-1.5">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Database size={13} />
                    MISSING EVIDENCE &amp; ACQUISITION PLAN
                  </span>
                  <span className="text-[9px] font-mono text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    Bhoonidhi / MOSDAC
                  </span>
                </div>

                {lastResponse.contract?.whyNotVerified && (
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Why not verified:</span>
                    <p className="text-xs text-slate-300 leading-snug">{lastResponse.contract.whyNotVerified}</p>
                  </div>
                )}

                {lastResponse.contract?.requiredObservation && (
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Required observation:</span>
                    <p className="text-xs text-blue-200 leading-snug">{lastResponse.contract.requiredObservation}</p>
                  </div>
                )}

                {/* One-Click Active Data Discovery from Indian EO Catalog */}
                <div className="pt-1">
                  <button
                    onClick={handleDiscoverEoData}
                    disabled={isSearchingEo}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow disabled:opacity-50"
                  >
                    {isSearchingEo ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Querying ISRO Bhoonidhi / MOSDAC Catalogue...</span>
                      </>
                    ) : (
                      <>
                        <Search size={14} />
                        <span>Search Bhoonidhi &amp; MOSDAC for Missing Data</span>
                      </>
                    )}
                  </button>
                </div>

                {eoSearchError && (
                  <p className="text-[11px] text-rose-400">{eoSearchError}</p>
                )}

                {/* Render Discovered Observations */}
                {eoSearchResults && eoSearchResults.length > 0 && (
                  <div className="mt-2 space-y-1.5 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                      ✓ Available Indian EO Observations ({eoSearchResults.length}):
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {eoSearchResults.map((obs: any, oIdx: number) => (
                        <div key={oIdx} className="bg-slate-900/80 p-2 rounded border border-slate-800 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200">{obs.satellite} • {obs.sensor}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                              {obs.access?.toUpperCase() || 'OPEN'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Product: {obs.productType} ({obs.resolution}) | Acquisition: {obs.acquisitionTime?.slice(0, 10)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. CONTRADICTING EVIDENCE & FALSIFIABILITY */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <XCircle size={13} />
                CONTRADICTING EVIDENCE &amp; CHALLENGES
              </span>
              {lastResponse.evidence?.contradictingEvidence && lastResponse.evidence.contradictingEvidence.length > 0 ? (
                <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc marker:text-rose-500">
                  {lastResponse.evidence.contradictingEvidence.map((con: string, idx: number) => (
                    <li key={idx} className="leading-snug">{con}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No contradictory physical evidence detected against candidate hypothesis.
                </p>
              )}
            </div>

            {/* 7. CONFOUNDER CHECKS */}
            {lastResponse.contract?.confoundersChecked && lastResponse.contract.confoundersChecked.length > 0 && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  CONFOUNDER CHECKS EVALUATED
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {lastResponse.contract.confoundersChecked.map((conf, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                      ✓ {conf}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 8. VISUAL GROUNDING COORDINATES (If bounding boxes present) */}
            {lastResponse.groundingBoxes && lastResponse.groundingBoxes.length > 0 && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Crosshair size={12} /> GROUNDING COORDINATES ({lastResponse.groundingBoxes.length})
                  </span>
                  <span className="text-[9px] font-mono text-slate-500">Scale: 0-1000 Normalized</span>
                </div>

                <div className="space-y-1.5">
                  {lastResponse.groundingBoxes.map((box, bIdx) => (
                    <div 
                      key={bIdx}
                      className="flex items-center justify-between bg-slate-900/60 p-2 rounded border border-slate-800 text-[11px] font-mono"
                    >
                      <span className="text-slate-200 font-semibold">{box.label}</span>
                      <span className="text-emerald-400 text-[10px]">
                        [{Math.round(box.ymin)}, {Math.round(box.xmin)}, {Math.round(box.ymax)}, {Math.round(box.xmax)}]
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. WHAT COULD CHANGE THE DECISION */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle size={13} />
                WHAT COULD CHANGE THE DECISION?
              </span>
              <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc marker:text-amber-500">
                {resolutionFactors.map((factor, idx) => (
                  <li key={idx} className="leading-snug">{factor}</li>
                ))}
              </ul>
            </div>

            {/* 10. LIMITATIONS & OPERATIONAL WARNINGS */}
            {lastResponse.confidence?.limitations && lastResponse.confidence.limitations.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-900/40 p-3 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Operational Limitations &amp; Disclaimers
                </span>
                <ul className="text-xs text-amber-200/80 space-y-1 pl-4 list-disc marker:text-amber-500">
                  {lastResponse.confidence.limitations.map((lim, idx) => (
                    <li key={idx} className="leading-snug">{lim}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 11. MODEL ROUTING & TOKEN TELEMETRY */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                AUDITABLE RUN PROVENANCE
              </span>

              <div className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded border border-slate-800">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-indigo-400" />
                  <span className="text-slate-300 font-medium">Provider &amp; Model</span>
                </div>
                <span className="font-mono text-indigo-300 font-bold">
                  {lastResponse.provider || 'Gemini'} ({lastResponse.model || 'Flash'})
                </span>
              </div>

              {lastResponse.tokenUsage && (
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono bg-slate-900/40 p-2 rounded border border-slate-800/80 text-center">
                  <div>
                    <span className="text-slate-500 block">PROMPT TOKENS</span>
                    <span className="text-slate-200 font-semibold">{lastResponse.tokenUsage.inputTokens.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">OUTPUT TOKENS</span>
                    <span className="text-slate-200 font-semibold">{lastResponse.tokenUsage.outputTokens.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">TOTAL TOKENS</span>
                    <span className="text-cyan-400 font-semibold">{lastResponse.tokenUsage.totalTokens.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
