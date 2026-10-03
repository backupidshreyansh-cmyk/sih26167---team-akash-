import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Send, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  XCircle, 
  Search, 
  Database, 
  FileDown, 
  Cpu, 
  Crosshair, 
  ShieldCheck,
  Compass,
  FileText,
  Layers
} from 'lucide-react';
import { AgentResponse, UploadedImage } from '../types';

interface UnifiedQuestionResultPanelProps {
  inputQuery: string;
  onChangeQuery: (query: string) => void;
  onSubmitQuery: () => void;
  isLoading: boolean;
  images: UploadedImage[];
  latestResponse?: AgentResponse;
  onDownloadReport: () => void;
}

export function UnifiedQuestionResultPanel({
  inputQuery,
  onChangeQuery,
  onSubmitQuery,
  isLoading,
  images,
  latestResponse,
  onDownloadReport
}: UnifiedQuestionResultPanelProps) {
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);
  
  // EO Search state for automatic/one-click missing evidence search
  const [isSearchingEo, setIsSearchingEo] = useState(false);
  const [eoSearchResults, setEoSearchResults] = useState<any[] | null>(null);
  const [eoSearchError, setEoSearchError] = useState<string | null>(null);

  // Dynamic suggestion questions based on current input configuration
  // Aligned with SIH 2026 PS 26227 Earth-observation analyst workflows
  const dynamicSuggestions = React.useMemo(() => {
    if (images.length >= 2) {
      return [
        "What changed between these observations?",
        "Assess possible construction",
        "Assess water extent change",
        "Check for seasonal explanation",
        "Review change evidence"
      ];
    }

    if (images.length === 1) {
      return [
        "Describe the scene",
        "Find visible development",
        "Identify water and surrounding land features",
        "Search for similar locations",
        "Compare with another observation",
        "Inspect acquisition metadata"
      ];
    }

    return [
      "Find areas with new construction near a river",
      "Find scenes showing large vehicle concentrations on open ground",
      "Find dense built-up areas near major roads",
      "Search the Earth-observation archive"
    ];
  }, [images]);

  // Extract strict Decision Status compliant with PS 26227
  const getDecisionStatus = (contractDecision?: string) => {
    const raw = (contractDecision || '').toUpperCase();
    if (raw === 'SUPPORTED_CHANGE' || raw === 'VERIFIED') {
      return {
        label: raw === 'SUPPORTED_CHANGE' ? 'SUPPORTED CHANGE' : 'VERIFIED',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        bgColor: 'bg-emerald-950/30',
        icon: <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />,
        description: 'Persistent spatial difference verified; alignment validated; no dominant confounder.'
      };
    }
    if (raw === 'POSSIBLE_CHANGE') {
      return {
        label: 'POSSIBLE CHANGE',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        bgColor: 'bg-amber-950/30',
        icon: <AlertTriangle size={16} className="text-amber-400 shrink-0" />,
        description: 'Candidate difference detected. Further temporal evidence is recommended before treating as confirmed.'
      };
    }
    if (raw === 'LIKELY_SEASONAL_VARIATION') {
      return {
        label: 'LIKELY SEASONAL VARIATION',
        textColor: 'text-yellow-400',
        borderColor: 'border-yellow-500/30',
        bgColor: 'bg-yellow-950/30',
        icon: <AlertTriangle size={16} className="text-yellow-400 shrink-0" />,
        description: 'Differences consistent with agricultural phenology or seasonal vegetation cycles.'
      };
    }
    if (raw === 'REGISTRATION_UNCERTAIN') {
      return {
        label: 'REGISTRATION UNCERTAIN',
        textColor: 'text-orange-400',
        borderColor: 'border-orange-500/30',
        bgColor: 'bg-orange-950/30',
        icon: <AlertCircle size={16} className="text-orange-400 shrink-0" />,
        description: 'Sub-pixel co-registration ambiguity detected. Edge differences may be alignment artifacts.'
      };
    }
    if (raw === 'NO_SIGNIFICANT_CHANGE') {
      return {
        label: 'NO SIGNIFICANT CHANGE',
        textColor: 'text-blue-400',
        borderColor: 'border-blue-500/30',
        bgColor: 'bg-blue-950/30',
        icon: <CheckCircle2 size={16} className="text-blue-400 shrink-0" />,
        description: 'Surface footprint and radiometric moments remain stable between observations.'
      };
    }
    if (raw.includes('CONFLICT') || raw === 'CROSS_SENSOR_UNCERTAIN') {
      return {
        label: raw === 'CROSS_SENSOR_UNCERTAIN' ? 'CROSS SENSOR UNCERTAIN' : 'EVIDENCE CONFLICT',
        textColor: 'text-rose-400',
        borderColor: 'border-rose-500/30',
        bgColor: 'bg-rose-950/30',
        icon: <XCircle size={16} className="text-rose-400 shrink-0" />,
        description: 'Sensor modalities or physical signatures present conflicting indications.'
      };
    }
    if (raw.includes('NEEDS_MORE') || raw.includes('MORE_DATA')) {
      return {
        label: 'NEEDS MORE DATA',
        textColor: 'text-sky-400',
        borderColor: 'border-sky-500/30',
        bgColor: 'bg-sky-950/30',
        icon: <AlertCircle size={16} className="text-sky-400 shrink-0" />,
        description: 'Temporal comparison requires an additional observation from another acquisition date.'
      };
    }
    return {
      label: 'INCONCLUSIVE',
      textColor: 'text-amber-400',
      borderColor: 'border-amber-500/30',
      bgColor: 'bg-amber-950/30',
      icon: <AlertTriangle size={16} className="text-amber-400 shrink-0" />,
      description: 'Observation verified as baseline. Multi-temporal comparison requires an additional observation.'
    };
  };

  const decision = getDecisionStatus(
    latestResponse?.contract?.finalDecision || 
    latestResponse?.confidence?.finalDecision || 
    latestResponse?.confidence?.level
  );

  // Search Bhoonidhi / MOSDAC catalogue for missing observation
  const handleDiscoverEoData = async () => {
    if (isSearchingEo) return;
    setIsSearchingEo(true);
    setEoSearchError(null);
    try {
      const res = await fetch('/api/eo/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: latestResponse?.contract?.query || 'Multimodal remote sensing satellite imagery',
          modality: latestResponse?.recommendedModality || 'OPTICAL'
        })
      });
      if (!res.ok) throw new Error(`Discovery failed with status ${res.status}`);
      const data = await res.json();
      setEoSearchResults(data.candidates || data.observations || []);
    } catch (err: any) {
      setEoSearchError(err.message || 'Unable to connect to EO catalogue service.');
    } finally {
      setIsSearchingEo(false);
    }
  };

  // Tripartite Separation data
  const observedAndMeasured = latestResponse?.contract?.observedAndMeasured?.length
    ? latestResponse.contract.observedAndMeasured
    : (latestResponse?.contract?.observations?.length
        ? latestResponse.contract.observations
        : latestResponse?.evidence?.observations || []);

  const inferred = latestResponse?.contract?.inferred?.length
    ? latestResponse.contract.inferred
    : (latestResponse?.evidence?.interpretations?.length
        ? latestResponse.evidence.interpretations
        : []);

  const notEstablished = latestResponse?.contract?.notEstablished?.length
    ? latestResponse.contract.notEstablished
    : (latestResponse?.contract?.limitations?.length
        ? latestResponse.contract.limitations
        : ['Ground-truth confirmation without in-situ ground sensors cannot be established.']);

  const multiImageComparison = latestResponse?.contract?.multiImageComparison || (latestResponse as any)?.multiImageComparison;

  const evidenceUsed = React.useMemo(() => {
    const list: string[] = [];
    if (images.length === 1) {
      list.push(`Input observation: ${images[0].metadata?.fileName || 'Primary satellite raster'}`);
    } else if (images.length > 1) {
      images.forEach((img, idx) => {
        list.push(`Input observation ${idx + 1}: ${img.metadata?.fileName || `Image ${idx + 1}`}`);
      });
    }
    if (latestResponse?.contract?.confoundersChecked?.length) {
      list.push(`Evaluated confounders: ${latestResponse.contract.confoundersChecked.join(', ')}`);
    }
    if (latestResponse?.contract?.requiredEvidence?.length) {
      latestResponse.contract.requiredEvidence.slice(0, 2).forEach(re => list.push(re));
    }
    return list;
  }, [images, latestResponse]);

  const contradictions = latestResponse?.evidence?.contradictingEvidence || [];
  const limitations = latestResponse?.confidence?.limitations || latestResponse?.contract?.limitations || [];

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden select-none">
      
      {/* 1. TOP QUESTION AREA */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-900/90 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-200">
            Earth-Observation Investigation Bay
          </label>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-cyan-400 font-medium">
            {images.length === 0 && "Archive Search Mode (0 observations loaded)"}
            {images.length === 1 && "1 observation loaded (Baseline / Scene Interpretation)"}
            {images.length === 2 && "2 observations loaded (Multi-Temporal Comparison Active)"}
            {images.length > 2 && `${images.length} observations loaded (Multi-Temporal Persistence Active)`}
          </span>
        </div>

        {/* Question Input Box */}
        <div className="relative">
          <textarea
            value={inputQuery}
            onChange={(e) => onChangeQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmitQuery();
              }
            }}
            placeholder={
              images.length >= 2
                ? "Investigate multi-temporal changes across these observations..."
                : images.length === 1
                  ? "What would you like to investigate in this Earth-observation scene?"
                  : "Search satellite archive (e.g. Find newly built structures near a river)..."
            }
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none resize-none transition-colors"
          />
        </div>

        {/* Suggested Prompt Chips */}
        <div className="mt-2">
          <div className="flex flex-wrap gap-1.5">
            {dynamicSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChangeQuery(suggestion)}
                className="text-left text-[11px] text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-750 px-2 py-0.5 rounded transition-colors cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onSubmitQuery}
            disabled={isLoading || (!inputQuery.trim() && images.length === 0)}
            className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Analyzing Evidence...</span>
              </>
            ) : (
              <>
                <Send size={13} />
                <span>ANALYZE EVIDENCE</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* 2. RESULTS & EVIDENCE AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-slate-200">
                Evaluating Remote-Sensing Evidence
              </h3>
              <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                Extracting pixel statistics, verifying spectral/backscatter indicators, and enforcing decision gate...
              </p>
            </div>
          </div>
        ) : !latestResponse ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <Compass size={28} className="opacity-30" />
            <h3 className="text-xs font-medium text-slate-300">Awaiting Analysis</h3>
            <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
              Upload imagery and ask a question. SatQuery AI automatically verifies measurable evidence and answers only when justified.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">

            {/* 1. DIRECT OBSERVATIONS (FIRST) */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  Direct Observations
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Directly Visible &amp; Measured</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 pl-4 list-disc marker:text-emerald-400">
                {observedAndMeasured.slice(0, 5).map((obs: any, idx: number) => (
                  <li key={idx} className="leading-snug">
                    {typeof obs === 'string' ? obs : obs.text}
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. INTERPRETATION (WHAT THE EVIDENCE SUGGESTS) */}
            {inferred.length > 0 && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-[10px] font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass size={13} className="text-sky-400" />
                    Interpretation
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">What the Evidence Suggests</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 pl-4 list-disc marker:text-sky-400">
                  {inferred.slice(0, 4).map((inf: any, idx: number) => (
                    <li key={idx} className="leading-snug">
                      {typeof inf === 'string' ? inf : inf.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 3. DECISION (VERIFIED / INCONCLUSIVE) & DIRECT ANSWER */}
            <div className={`p-4 rounded-xl border ${decision.borderColor} ${decision.bgColor} space-y-2.5`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold">
                  Final Decision
                </span>
                <div className="flex items-center gap-1.5">
                  {decision.icon}
                  <span className={`text-xs font-bold uppercase tracking-wider ${decision.textColor}`}>
                    {decision.label}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                {decision.description}
              </p>

              {/* Direct Answer */}
              <div className="pt-2 border-t border-slate-800/60">
                <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Answer Summary
                </span>
                <div className="prose prose-sm prose-invert max-w-none text-slate-100 text-xs leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {latestResponse.answer}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* 4. LIMITATIONS */}
            {limitations.length > 0 && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">
                  Limitations
                </span>
                <ul className="text-xs text-slate-400 space-y-1 pl-4 list-disc marker:text-slate-600">
                  {limitations.slice(0, 3).map((lim: string, idx: number) => (
                    <li key={idx} className="leading-snug">{lim}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 5. MISSING EVIDENCE IN PLAIN LANGUAGE (When system abstains or inconclusive) */}
            {(decision.label === 'NEEDS MORE DATA' || decision.label === 'INCONCLUSIVE' || latestResponse.contract?.whyNotVerified) && (
              <div className="bg-slate-950 border border-amber-900/40 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-amber-400" />
                    Missing Evidence &amp; Guidance
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Plain-Language Explanation
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Why the system abstained:</span>
                  <p className="text-xs text-slate-200 leading-snug">
                    {latestResponse.contract?.whyNotVerified || latestResponse.contract?.why || "Available evidence supports observable pixels and plausible interpretations, but does not establish quantitative proof or causal attribution."}
                  </p>
                </div>

                {latestResponse.contract?.whatDataIsRequired && (
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Required evidence to verify:</span>
                    <p className="text-xs text-blue-300 leading-snug">{latestResponse.contract.whatDataIsRequired}</p>
                  </div>
                )}

                {latestResponse.contract?.whatTheUserShouldUpload && (
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Recommended upload:</span>
                    <p className="text-xs text-emerald-300 leading-snug">{latestResponse.contract.whatTheUserShouldUpload}</p>
                  </div>
                )}

                {/* Search Bhoonidhi Button */}
                <div className="pt-2 border-t border-slate-900">
                  <button
                    type="button"
                    onClick={handleDiscoverEoData}
                    disabled={isSearchingEo}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow disabled:opacity-50"
                  >
                    {isSearchingEo ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Searching Available Earth-Observation Data...</span>
                      </>
                    ) : (
                      <>
                        <Search size={14} />
                        <span>Search Available Earth-Observation Data</span>
                      </>
                    )}
                  </button>
                </div>

                {eoSearchError && (
                  <p className="text-[11px] text-rose-400">{eoSearchError}</p>
                )}

                {/* Discovered Real Satellite Observations */}
                {eoSearchResults && eoSearchResults.length > 0 && (
                  <div className="mt-2 space-y-2 bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-mono font-semibold text-emerald-400 uppercase tracking-wider block">
                      ✓ Suitable Earth-Observation Data Found ({eoSearchResults.length})
                    </span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {eoSearchResults.map((obs: any, oIdx: number) => (
                        <div key={oIdx} className="bg-slate-950 p-2.5 rounded border border-slate-800 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-100">
                              Source: {obs.source || 'Bhoonidhi'}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900">
                              {obs.access?.toUpperCase() || 'OPEN'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400">
                            <div><span className="text-slate-500">Satellite:</span> {obs.satellite}</div>
                            <div><span className="text-slate-500">Sensor:</span> {obs.sensor}</div>
                            <div><span className="text-slate-500">Acquisition:</span> {obs.acquisitionTime?.slice(0, 10) || 'Recent'}</div>
                            <div><span className="text-slate-500">Resolution:</span> {obs.resolution}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MULTI-IMAGE COMPARATIVE ANALYSIS */}
            {multiImageComparison && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-indigo-900/50 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[10px] font-mono font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-400" />
                    Comparative Analysis
                  </span>
                  <span className="text-[10px] text-indigo-300 font-mono bg-indigo-950 px-2 py-0.5 rounded border border-indigo-900/60">
                    {multiImageComparison.relationshipLabel}
                  </span>
                </div>

                {multiImageComparison.summary && (
                  <p className="text-xs text-slate-300 leading-snug">
                    {multiImageComparison.summary}
                  </p>
                )}

                <div className="space-y-2 pt-1">
                  {multiImageComparison.whatChangedOrDiffers && multiImageComparison.whatChangedOrDiffers.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                        What Changed / Differs
                      </span>
                      <ul className="text-xs text-slate-300 space-y-1 pl-3.5 list-disc marker:text-cyan-400">
                        {multiImageComparison.whatChangedOrDiffers.map((item: string, idx: number) => (
                          <li key={idx} className="leading-snug">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {multiImageComparison.whatStayedSame && multiImageComparison.whatStayedSame.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        What Stayed the Same
                      </span>
                      <ul className="text-xs text-slate-300 space-y-1 pl-3.5 list-disc marker:text-emerald-400">
                        {multiImageComparison.whatStayedSame.map((item: string, idx: number) => (
                          <li key={idx} className="leading-snug">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {multiImageComparison.whatCannotBeCompared && multiImageComparison.whatCannotBeCompared.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        Incomparable Differences (Sensor, Angle, or Resolution)
                      </span>
                      <ul className="text-xs text-slate-400 space-y-1 pl-3.5 list-disc marker:text-amber-400">
                        {multiImageComparison.whatCannotBeCompared.map((item: string, idx: number) => (
                          <li key={idx} className="leading-snug">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* H. EXPANDABLE TECHNICAL ANALYSIS DETAILS */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAnalysisDetails(!showAnalysisDetails)}
                className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-blue-400" />
                  <span className="font-semibold">View analysis details</span>
                </div>
                {showAnalysisDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showAnalysisDetails && (
                <div className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3 text-xs">
                  
                  {/* Selected Tools & Remote Sensing Modules */}
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                      Deterministic Tools &amp; Engines Executed
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(latestResponse.audit?.toolsUsed?.length ? latestResponse.audit.toolsUsed : ['DeterministicEngine', 'RemoteSensingEvidenceEngine']).map((tool, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* AI Provider & Model */}
                  <div className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Cpu size={14} className="text-blue-400" />
                      <span className="text-slate-300 font-medium">Provider &amp; Model</span>
                    </div>
                    <span className="font-mono text-blue-300 font-semibold">
                      {latestResponse.provider || 'Gemini'} ({latestResponse.model || 'Flash'})
                    </span>
                  </div>

                  {/* Data Quality & CRS */}
                  <div className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-400">Data Quality:</span>
                    <span className="font-mono text-slate-200">
                      {images.some(i => i.metadata?.epsg || i.metadata?.crs)
                        ? 'Calibrated Spatial CRS'
                        : 'Pixel Coordinate Space'}
                    </span>
                  </div>

                  {/* Model Confidence with Strict Disclaimer */}
                  <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Model Confidence:</span>
                      <span className="text-cyan-400 font-mono font-bold">
                        {latestResponse.contract?.modelConfidence || latestResponse.confidence?.level || 'MEDIUM'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                      Model confidence — not evidence of truth. Does not determine the verified state.
                    </p>
                  </div>

                  {/* Grounding Bounding Box Coordinates */}
                  {latestResponse.groundingBoxes && latestResponse.groundingBoxes.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                        <span className="text-[10px] font-mono font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                          <Crosshair size={12} /> Grounding Coordinates ({latestResponse.groundingBoxes.length})
                        </span>
                        <span className="text-[9px] font-mono text-slate-500">0-1000 Normalized</span>
                      </div>
                      <div className="space-y-1">
                        {latestResponse.groundingBoxes.map((box, bIdx) => (
                          <div 
                            key={bIdx}
                            className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded border border-slate-800 text-[11px] font-mono"
                          >
                            <span className="text-slate-200 truncate">{box.label}</span>
                            <span className="text-emerald-400 text-[10px] ml-2 shrink-0">
                              [{Math.round(box.ymin)}, {Math.round(box.xmin)}, {Math.round(box.ymax)}, {Math.round(box.xmax)}]
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Complete Execution Trace */}
                  {latestResponse.executionTrace && latestResponse.executionTrace.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">
                        Execution Trace ({latestResponse.executionTrace.length} steps)
                      </span>
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {latestResponse.executionTrace.map((tr, tIdx) => (
                          <div key={tIdx} className="bg-slate-900/60 p-1.5 rounded border border-slate-800 text-[10px] font-mono flex items-start gap-1.5">
                            <span className={`px-1 py-0.2 rounded shrink-0 ${
                              tr.status === 'SUCCESS' ? 'text-emerald-400 bg-emerald-950/60' :
                              tr.status === 'WARNING' ? 'text-amber-400 bg-amber-950/60' :
                              tr.status === 'ERROR' ? 'text-rose-400 bg-rose-950/60' : 'text-slate-400 bg-slate-800'
                            }`}>
                              {tr.status}
                            </span>
                            <div className="truncate">
                              <span className="text-slate-300 font-semibold">{tr.step}:</span>{' '}
                              <span className="text-slate-400">{tr.details || ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Download Auditable Report */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={onDownloadReport}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-850 text-slate-200 font-medium text-xs rounded-lg border border-slate-750 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <FileDown size={14} className="text-blue-400" />
                      <span>Download Auditable Analysis Report (.md)</span>
                    </button>
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
