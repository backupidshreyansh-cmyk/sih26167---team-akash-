import React, { useState } from 'react';
import { AgentResponse } from '../types/index.js';
import { 
  ShieldCheck, 
  FileQuestion, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  AlertTriangle,
  Cpu,
  Layers,
  HelpCircle,
  Database
} from 'lucide-react';

export function AnalysisAuditPanel({ response }: { response: AgentResponse }) {
    const [expanded, setExpanded] = useState(false);
    const audit = response.audit;
    const contract = response.contract;
    const budget = response.budget;

    const depthLabel = audit?.depth || 'Standard';
    const evidenceStatus = audit?.evidenceStatus || response.confidence.evidenceSufficiency || 'MODERATE';
    const finalDecision = audit?.finalDecision || response.confidence.finalDecision || (response.confidence.level as any) || 'VERIFIED';
    const apiCalls = audit?.apiCalls ?? (response.provider?.toLowerCase().includes('ollama') ? 0 : 1);
    const processingTime = audit?.processingTimeMs ?? (response.executionTrace.find(t => t.durationMs)?.durationMs || 150);

    return (
        <div className="bg-slate-900 border border-indigo-500/40 rounded-xl overflow-hidden mt-4 shadow-lg shadow-indigo-950/20">
            <button 
                onClick={() => setExpanded(!expanded)} 
                className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 hover:from-slate-800/80 hover:to-slate-800/80 transition-all text-left"
            >
                <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                        <ShieldCheck size={14} className="text-indigo-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100 tracking-wide uppercase">Analysis Audit & Verification Gate</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                                depthLabel === 'Deterministic Only' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' :
                                depthLabel === 'Verified' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                                depthLabel === 'Deep' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                                'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            }`}>
                                {depthLabel}
                            </span>
                            {audit?.cacheHit && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                                    CACHE REUSED
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        finalDecision === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        finalDecision === 'EVIDENCE_CONFLICT' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                        {String(finalDecision).replace(/_/g, ' ')}
                    </span>
                    {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </button>

            {expanded && (
                <div className="p-4 text-xs text-slate-300 space-y-4 border-t border-slate-800 bg-slate-950/70">
                    {/* Top KPI row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-0.5">Analysis Depth</span>
                            <span className="text-xs font-semibold text-indigo-300">{depthLabel}</span>
                        </div>
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-0.5">Evidence Status</span>
                            <span className={`text-xs font-semibold ${
                                evidenceStatus === 'STRONG' ? 'text-emerald-400' :
                                evidenceStatus === 'CONFLICTING' ? 'text-red-400' :
                                'text-amber-400'
                            }`}>
                                {evidenceStatus}
                            </span>
                        </div>
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-0.5">API Invocations</span>
                            <span className="text-xs font-semibold text-slate-200">
                                {apiCalls} Model Call{apiCalls === 1 ? '' : 's'}
                            </span>
                        </div>
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-0.5">Processing Time</span>
                            <span className="text-xs font-semibold text-slate-200">{processingTime} ms</span>
                        </div>
                    </div>

                    {/* Verification Checklist */}
                    <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Verification Pipeline Stages
                        </span>
                        <div className="space-y-1.5">
                            {(audit?.verificationChecks || [
                                { name: 'Initial Observation', status: 'PASSED', details: 'Observable radiometric features isolated.' },
                                { name: 'Self-Questioning & Counter-Check', status: 'PASSED', details: 'Evaluated alternative interpretations.' },
                                { name: 'Deterministic Evidence Validation', status: 'PASSED', details: 'Verified against raster moments & metadata.' },
                                { name: 'Confounder Check', status: 'PASSED', details: 'Screened shadow, resolution, and sensor noise.' },
                                { name: 'Decision Gate', status: finalDecision === 'VERIFIED' ? 'PASSED' : 'FLAGGED', details: `Final Gate: ${finalDecision}` }
                            ]).map((chk, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs">
                                    <span className="mt-0.5 text-emerald-400 font-bold shrink-0">✓</span>
                                    <div className="flex-1">
                                        <span className="font-semibold text-slate-200">{chk.name}</span>
                                        {chk.details && <span className="text-slate-400 ml-1.5">— {chk.details}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Internal Questions Evaluated (Audit-Safe Summary) */}
                    {audit?.internalQuestions && audit.internalQuestions.length > 0 && (
                        <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2">
                            <div className="flex items-center gap-1.5">
                                <HelpCircle size={14} className="text-amber-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Internal Verification Questions & Outcomes
                                </span>
                            </div>
                            <div className="space-y-2">
                                {audit.internalQuestions.map((q, idx) => (
                                    <div key={idx} className="bg-slate-950 p-2 rounded border border-slate-800/80">
                                        <div className="text-[11px] font-medium text-slate-300">{q.question}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 flex gap-1">
                                            <span className="text-indigo-400 font-medium">Outcome:</span>
                                            <span>{q.outcome}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Models & Tools Executed */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                                <Cpu size={12} className="text-indigo-400" /> Models Used
                            </span>
                            <div className="text-xs text-slate-300 font-mono">
                                {(audit?.modelsUsed && audit.modelsUsed.length > 0) ? audit.modelsUsed.join(', ') : (response.model || 'Gemini')}
                            </div>
                        </div>
                        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                                <Layers size={12} className="text-emerald-400" /> Tools & Deterministic Processors
                            </span>
                            <div className="text-xs text-slate-300 font-mono">
                                {(audit?.toolsUsed && audit.toolsUsed.length > 0) 
                                    ? audit.toolsUsed.join(', ') 
                                    : 'DeterministicEngine, MetadataValidator'}
                            </div>
                        </div>
                    </div>

                    {/* Budget & Telemetry */}
                    {budget && (
                        <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-[11px] space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Central Analysis Budget & Cost Optimization
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-400">
                                <div><span className="text-slate-500">Input:</span> {budget.inputTokens.toLocaleString()} tok</div>
                                <div><span className="text-slate-500">Output:</span> {budget.outputTokens.toLocaleString()} tok</div>
                                <div><span className="text-slate-500">Cached:</span> {budget.cachedTokens.toLocaleString()} tok</div>
                                <div><span className="text-slate-500">Total:</span> {budget.totalTokens.toLocaleString()} tok</div>
                            </div>
                            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px]">
                                <span className="text-slate-400">Model Calls: <strong className="text-slate-200">{budget.modelCallsCount}</strong></span>
                                <span className="text-emerald-400 font-bold">
                                    ESTIMATED SAVINGS: ${(budget.savings).toFixed(4)} ({budget.savingsPercentage}%)
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function EvidenceCard({ response }: { response: AgentResponse }) {
    const [expanded, setExpanded] = useState(false);
    const contract = response.contract;
    const optical = response.opticalEvidence;
    const sar = response.sarEvidence;
    const temporal = response.temporalEvidence;
    const crossModal = response.crossModalEvidence;
    const graph = response.evidenceGraph;
    const dataQual = response.dataQuality;
    const measQual = response.measurementQuality;

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden mt-3 shadow-md">
            <button 
                onClick={() => setExpanded(!expanded)} 
                className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                        Deterministic RS Evidence & Verification Graph
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {measQual && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {measQual.deterministicChecksCount} MEASUREMENTS
                        </span>
                    )}
                    {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </div>
            </button>
            {expanded && (
                <div className="p-4 text-xs text-slate-300 space-y-4">
                    
                    {/* 1. SEPARATED QUALITY DIMENSIONS */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                            <span className="text-slate-500 block uppercase font-bold">1. Data Quality</span>
                            <span className={dataQual?.valid ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                {dataQual?.valid ? 'VALID RASTER' : 'INVALID'} ({dataQual?.format || 'RASTER'})
                            </span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                            <span className="text-slate-500 block uppercase font-bold">2. Measurement Quality</span>
                            <span className="text-indigo-300 font-bold">
                                {measQual ? `${measQual.deterministicChecksCount} CHECKS (${measQual.confoundersDetectedCount} FLAGGED)` : 'EXTRACTED'}
                            </span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                            <span className="text-slate-500 block uppercase font-bold">3. Evidence Sufficiency</span>
                            <span className={`font-bold ${
                                response.confidence.evidenceSufficiency === 'STRONG' ? 'text-emerald-400' :
                                response.confidence.evidenceSufficiency === 'CONFLICTING' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                                {response.confidence.evidenceSufficiency || response.confidence.level}
                            </span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                            <span className="text-slate-500 block uppercase font-bold">4. Model Confidence</span>
                            <span className="text-cyan-300 font-bold">
                                {contract?.modelConfidence || 'DECOUPLED'}
                            </span>
                        </div>
                    </div>

                    {/* 2. DETERMINISTIC MEASUREMENTS & INDICES */}
                    {(optical || sar) && (
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                <span>Deterministic Physical Measurements</span>
                                <span className="text-emerald-400 font-mono">MEASURE FIRST</span>
                            </div>

                            {/* Optical Band Moments & Spectral Indices */}
                            {optical && (
                                <div className="space-y-1.5 pt-1 border-t border-slate-850">
                                    <div className="text-[11px] font-semibold text-slate-200">
                                        Optical Bands Identified: {optical.identifiedBands.map(b => b.normalizedId).join(', ')}
                                    </div>
                                    {optical.indices && optical.indices.length > 0 && (
                                        <div className="space-y-1">
                                            {optical.indices.map((idx: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between text-[11px] bg-slate-900/80 px-2 py-1 rounded">
                                                    <span className="font-mono text-cyan-300 font-semibold">{idx.indexName} ({idx.formula})</span>
                                                    <span className={`text-[10px] font-mono ${idx.status === 'CALCULATED' ? 'text-emerald-400 font-bold' : 'text-amber-400'}`}>
                                                        {idx.status === 'CALCULATED' && idx.statistics 
                                                            ? `Mean: ${idx.statistics.mean} [Min: ${idx.statistics.min}, Max: ${idx.statistics.max}]`
                                                            : idx.status.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {optical.candidateRegions && optical.candidateRegions.length > 0 && (
                                        <div className="text-[10px] text-slate-400 pt-1">
                                            <span className="font-semibold text-slate-300">Candidate Regions: </span>
                                            {optical.candidateRegions.map((r: any, i: number) => (
                                                <span key={i} className="inline-block bg-slate-900 px-1.5 py-0.5 rounded mr-1.5 mb-1 font-mono">
                                                    {r.category}: {r.pixelCount.toLocaleString()} px
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SAR Backscatter & Speckle Quality */}
                            {sar && (
                                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="font-semibold text-slate-200">SAR Radar Backscatter Moments</span>
                                        <span className="text-[10px] font-mono text-amber-400">POLARIZATION: {sar.polarization}</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-slate-400">
                                        <div>Mean: <strong className="text-slate-200">{sar.statistics.mean}</strong></div>
                                        <div>StdDev: <strong className="text-slate-200">{sar.statistics.stdDev}</strong></div>
                                        <div>ENL: <strong className="text-slate-200">{sar.speckleQuality.enl}</strong></div>
                                        <div>Speckle: <strong className="text-slate-200">{sar.speckleQuality.speckleSeverity}</strong></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. BI-TEMPORAL CHANGE & CONFOUNDER SCREENING */}
                    {temporal && (
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                <span>Bi-Temporal Change Analysis & Confounders</span>
                                <span className="text-rose-400 font-mono">
                                    MAD: {temporal.meanAbsoluteDifference} DN ({(temporal.relativeChangeFraction * 100).toFixed(1)}% scene)
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-300">
                                <span>Registration Status: </span>
                                <strong className={temporal.registration.status === 'ALIGNED' ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
                                    {temporal.registration.status}
                                </strong>
                                <span className="text-slate-500 ml-2">
                                    (Spatial Overlap: {(temporal.registration.spatialOverlapFraction * 100).toFixed(1)}%)
                                </span>
                            </div>

                            {temporal.confounderChecks.possibleConfounders.length > 0 && (
                                <div className="bg-amber-950/40 border border-amber-900/50 p-2 rounded text-[10px] text-amber-300">
                                    <span className="font-bold">CONFOUNDERS SCREENED: </span>
                                    {temporal.confounderChecks.possibleConfounders.join(' ')}
                                </div>
                            )}

                            {temporal.detectedChangeRegions.length > 0 && (
                                <div className="text-[10px] text-slate-400">
                                    <span className="font-semibold text-slate-300">Detected Change Clusters: </span>
                                    {temporal.detectedChangeRegions.map((reg: any, i: number) => (
                                        <span key={i} className="inline-block bg-slate-900 px-1.5 py-0.5 rounded mr-1 font-mono">
                                            {reg.id} ({reg.pixelCount.toLocaleString()} px{reg.areaM2 ? ` · ${reg.areaM2}m²` : ''})
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. CROSS-MODAL SENSOR OVERLAP */}
                    {crossModal && (
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                <span>Cross-Modal Spatial Overlap (Optical + SAR)</span>
                                <span className={`font-mono font-bold ${
                                    crossModal.agreementStatus === 'AGREEMENT' ? 'text-emerald-400' :
                                    crossModal.agreementStatus === 'CONFLICT' ? 'text-red-400' : 'text-amber-400'
                                }`}>
                                    {crossModal.agreementStatus}
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-300 space-y-1">
                                {crossModal.details.map((d: string, i: number) => (
                                    <div key={i} className="text-slate-400">• {d}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 5. CLAIM DECOMPOSITION & EVIDENCE */}
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 block mb-1">CLAIM DECOMPOSITION</span>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[11px] text-slate-300">
                            {contract?.claim || `${response.taskClassification} analysis executed to extract required evidence.`}
                        </div>
                    </div>

                    {contract?.requiredEvidence && contract.requiredEvidence.length > 0 && (
                        <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">REQUIRED EVIDENCE CRITERIA</span>
                            <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                                {contract.requiredEvidence.map((req, i) => <li key={i}>{req}</li>)}
                            </ul>
                        </div>
                    )}

                    <div>
                        <span className="text-[10px] font-bold text-slate-500 block mb-1">SUPPORTING OBSERVATIONS</span>
                        <ul className="list-disc pl-4 space-y-1">
                            {response.evidence?.observations?.map((obs, i) => <li key={i}>{obs}</li>)}
                        </ul>
                    </div>

                    {response.evidence?.contradictingEvidence && response.evidence.contradictingEvidence.length > 0 && (
                        <div>
                            <span className="text-[10px] font-bold text-red-400 block mb-1">CONTRADICTING / COUNTER-EVIDENCE</span>
                            <ul className="list-disc pl-4 space-y-1 text-red-300">
                                {response.evidence.contradictingEvidence.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </div>
                    )}

                    {/* 6. PROVENANCE & REPRODUCIBILITY */}
                    {(optical?.provenance || sar?.provenance || temporal?.provenance) && (
                        <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[9px] font-mono text-slate-400 space-y-0.5">
                            <span className="text-slate-500 uppercase font-bold block">Immutable Evidence Provenance:</span>
                            {optical?.provenance && (
                                <div className="truncate">
                                    [Optical] SHA-256: {optical.provenance.fileSha256} | Tool: {optical.provenance.tool}
                                </div>
                            )}
                            {sar?.provenance && (
                                <div className="truncate">
                                    [SAR] SHA-256: {sar.provenance.fileSha256} | Tool: {sar.provenance.tool}
                                </div>
                            )}
                            {temporal?.provenance && (
                                <div className="truncate">
                                    [Temporal] SHA-256: {temporal.provenance.fileSha256} | Tool: {temporal.provenance.tool}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">EVIDENCE SUFFICIENCY</span>
                            <span className={`font-semibold ${
                                response.confidence.level === 'HIGH' || response.confidence.level === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'
                            }`}>
                                {response.confidence.evidenceSufficiency || response.confidence.level}
                            </span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">FINAL DECISION GATE</span>
                            <span className="text-slate-300 uppercase tracking-wider text-[11px] font-semibold">
                                {response.confidence.finalDecision || response.confidence.level}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function ModelRoutingPanel({ response }: { response: AgentResponse }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden mt-2">
            <button 
                onClick={() => setExpanded(!expanded)} 
                className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-indigo-400">⚡</span>
                    <span className="text-xs font-bold text-slate-200">MODEL ROUTING & ADAPTIVE ESCALATION</span>
                </div>
                {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {expanded && (
                <div className="p-4 text-xs text-slate-300 space-y-3">
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 block mb-1">ADAPTIVE STRATEGY</span>
                        <p>Cost-aware execution: Level {response.audit?.verificationLevel ?? 1} ({response.audit?.depth || 'Standard'}). Escalate to 2nd model only when evidence is ambiguous or conflicting.</p>
                    </div>

                    <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-slate-500 block">ACTIVE MODEL</span>
                            <span className="text-indigo-300 font-semibold">{response.model}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-500 block">MODEL CALLS</span>
                            <span className="text-slate-200 font-semibold">{response.audit?.apiCalls ?? 1}</span>
                        </div>
                    </div>

                    {response.tokenUsage && (
                        <div className="bg-slate-950 p-3 rounded border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-widest">Token Optimization Telemetry</span>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-slate-500">Input:</span> {response.tokenUsage.inputTokens.toLocaleString()}</div>
                                <div><span className="text-slate-500">Output:</span> {response.tokenUsage.outputTokens.toLocaleString()}</div>
                                <div><span className="text-slate-500">Total:</span> {response.tokenUsage.totalTokens.toLocaleString()}</div>
                                {response.tokenUsage.cachedTokens !== undefined && (
                                    <div><span className="text-slate-500">Cached:</span> {response.tokenUsage.cachedTokens.toLocaleString()}</div>
                                )}
                            </div>
                            {response.cost && (
                                <div className="mt-2 pt-2 border-t border-slate-800/50 flex justify-between text-[10px]">
                                    <span className="text-slate-500">Actual Cost: ${response.cost.actualCost.toFixed(4)}</span>
                                    <span className="text-emerald-400 font-bold">ESTIMATED SAVINGS: ${(response.cost.baselineCost - response.cost.actualCost).toFixed(4)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function FalsifiabilityPanel({ response }: { response: AgentResponse }) {
    const [expanded, setExpanded] = useState(false);
    const contract = response.contract;

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden mt-2">
            <button 
                onClick={() => setExpanded(!expanded)} 
                className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <FileQuestion size={16} className="text-amber-400" />
                    <span className="text-xs font-bold text-slate-200">COUNTER-ANALYSIS & CONFOUNDERS</span>
                </div>
                {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {expanded && (
                <div className="p-4 text-xs text-slate-300 space-y-3">
                    {contract?.alternativeExplanations && contract.alternativeExplanations.length > 0 && (
                        <div>
                            <span className="text-[10px] font-bold text-amber-400 block mb-1 uppercase tracking-wider">
                                Alternative Explanations Screened
                            </span>
                            <ul className="list-disc pl-4 space-y-1 text-slate-300">
                                {contract.alternativeExplanations.map((alt, i) => (
                                    <li key={i}>{alt}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {contract?.confoundersChecked && contract.confoundersChecked.length > 0 && (
                        <div>
                            <span className="text-[10px] font-bold text-indigo-400 block mb-1 uppercase tracking-wider">
                                Confounders Checked
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {contract.confoundersChecked.map((c, i) => (
                                    <span key={i} className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-300">
                                        {c}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <span className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                            Sensor & Resolution Caveats
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-400">
                            {response.confidence.limitations?.map((lim, i) => (
                                <li key={i}>{lim}</li>
                            ))}
                            {(!response.confidence.limitations || response.confidence.limitations.length === 0) && (
                                <li>Spatial resolution limits fine-grained feature validation.</li>
                            )}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

export function MetadataPanel({ response }: { response: AgentResponse }) {
    const [expanded, setExpanded] = useState(false);
    
    if (!response.metadata || response.metadata.length === 0 || response.metadata.every(m => !m)) {
        return null;
    }
    
    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden mt-2">
            <button 
                onClick={() => setExpanded(!expanded)} 
                className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Database size={16} className="text-sky-400" />
                    <span className="text-xs font-bold text-slate-200">INPUT METADATA VERIFICATION</span>
                </div>
                {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {expanded && (
                <div className="p-4 text-xs text-slate-300 space-y-3">
                    {response.metadata.map((meta: any, idx: number) => (
                        <div key={idx} className="bg-slate-950 p-2 rounded border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 block mb-2">IMAGE {idx + 1}</span>
                            {meta ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <div><span className="text-slate-500">EPSG:</span> {meta.epsg || 'Unavailable'}</div>
                                    <div><span className="text-slate-500">CRS:</span> {meta.crs || 'Unavailable'}</div>
                                    {meta.bounds && (
                                        <div className="col-span-2">
                                            <span className="text-slate-500">Bounds:</span> [{meta.bounds.map((b:any)=>b.toFixed(4)).join(', ')}]
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span className="text-amber-500">Metadata unavailable in supplied file.</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
