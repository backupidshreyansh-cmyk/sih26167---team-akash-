import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Cpu, 
  DollarSign, 
  ChevronDown, 
  ChevronRight, 
  FileDown, 
  CheckCircle, 
  AlertCircle, 
  FileText,
  Zap,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { AgentResponse } from '../types';

interface EvidenceAuditPanelProps {
  response: AgentResponse | null;
  onDownloadReport: (response: AgentResponse) => void;
}

export const EvidenceAuditPanel: React.FC<EvidenceAuditPanelProps> = ({
  response,
  onDownloadReport
}) => {
  const [traceExpanded, setTraceExpanded] = useState(true);
  const [routingExpanded, setRoutingExpanded] = useState(true);
  const [evidenceExpanded, setEvidenceExpanded] = useState(true);

  if (!response) {
    return (
      <div className="w-full h-full bg-slate-950 flex flex-col p-6 overflow-y-auto select-none">
        <div className="p-8 border border-slate-800 rounded-2xl bg-slate-900/40 text-center my-auto max-w-md mx-auto">
          <Activity size={36} className="text-cyan-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-1">
            Telemetry & Audit Standby
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Run an inference query to generate real-time evidence graphs, model routing decisions, token telemetry, and execution traces.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      {/* Panel Top Title */}
      <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Evidence Graph & Telemetry
          </h2>
        </div>
        <button
          onClick={() => onDownloadReport(response)}
          className="text-xs font-mono font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-950/60 hover:bg-indigo-900/60 px-2.5 py-1 rounded-lg border border-indigo-800/60 transition-colors cursor-pointer"
          title="Download complete intelligence audit"
        >
          <FileDown size={13} />
          <span>REPORT</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* Evidence Card: Claim Decomposition & Sufficiency */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-md">
          <button
            onClick={() => setEvidenceExpanded(!evidenceExpanded)}
            className="w-full p-3 bg-slate-900 flex items-center justify-between text-xs font-bold text-slate-200 hover:bg-slate-850 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-400" />
              <span>WHY THIS ANSWER? (Evidence Graph)</span>
            </div>
            {evidenceExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {evidenceExpanded && (
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Claim Decomposition
                </span>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-indigo-300">
                  {response.taskClassification} analysis executed to isolate minimum-sufficient observables.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                    Evidence Sufficiency
                  </span>
                  <span
                    className={`font-mono font-bold text-xs ${
                      response.confidence.level === 'HIGH' || response.confidence.level === 'VERIFIED'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {response.confidence.level}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                    Recommended Modality
                  </span>
                  <span className="font-mono text-xs text-slate-300 truncate block">
                    {response.recommendedModality || 'CALIBRATED'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Model & Tool Routing Telemetry */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-md">
          <button
            onClick={() => setRoutingExpanded(!routingExpanded)}
            className="w-full p-3 bg-slate-900 flex items-center justify-between text-xs font-bold text-slate-200 hover:bg-slate-850 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span>ROUTING & AVOIDED COMPUTE</span>
            </div>
            {routingExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {routingExpanded && (
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div>
                  <span className="text-[9px] text-slate-500 block">ACTIVE PROVIDER</span>
                  <span className="text-xs text-indigo-300 font-bold">{response.provider}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 block">MODEL DEPLOYED</span>
                  <span className="text-xs text-cyan-300 font-bold">{response.model}</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[9px] text-slate-500 block mb-1">SELECTED TOOLS</span>
                <div className="flex flex-wrap gap-1">
                  {response.executionTrace
                    .filter(t => t.step.includes('_SELECTED'))
                    .map((t, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px]">
                        {t.step.replace('_SELECTED', '')}
                      </span>
                    ))}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center text-[10px]">
                <span className="text-slate-400">Brute-Force Multi-Agent:</span>
                <span className="text-emerald-400 font-bold">AVOIDED (Compute Saved)</span>
              </div>
            </div>
          )}
        </div>

        {/* Token Optimization & Cost Analytics */}
        {response.tokenUsage && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 shadow-md space-y-2 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-400" />
                Token Telemetry & Cost
              </span>
              <span className="text-[9px] text-emerald-400 font-bold">OPTIMIZED</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 text-[9px] block">Input Tokens</span>
                <span className="text-slate-200 font-bold">{response.tokenUsage.inputTokens.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 text-[9px] block">Output Tokens</span>
                <span className="text-slate-200 font-bold">{response.tokenUsage.outputTokens.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 text-[9px] block">Total Tokens</span>
                <span className="text-slate-200 font-bold">{response.tokenUsage.totalTokens.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 text-[9px] block">Cached Context</span>
                <span className="text-slate-400 font-bold">{response.tokenUsage.cachedTokens || 0}</span>
              </div>
            </div>

            {response.cost && (
              <div className="p-2 rounded bg-slate-950 border border-emerald-900/50 flex justify-between items-center text-[10px]">
                <span className="text-slate-400">Measured Inference Cost:</span>
                <div className="text-right">
                  <span className="text-emerald-400 font-bold">${response.cost.actualCost.toFixed(5)}</span>
                  <span className="text-[9px] text-slate-500 block">
                    (Saved ${(response.cost.baselineCost - response.cost.actualCost).toFixed(4)} vs Pro)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Auditable Execution Trace Log */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-md">
          <button
            onClick={() => setTraceExpanded(!traceExpanded)}
            className="w-full p-3 bg-slate-900 flex items-center justify-between text-xs font-bold text-slate-200 hover:bg-slate-850 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-cyan-400" />
              <span>AUDITABLE TRACE ({response.executionTrace.length} STEPS)</span>
            </div>
            {traceExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {traceExpanded && (
            <div className="p-3 bg-slate-950 border-t border-slate-800 max-h-72 overflow-y-auto space-y-2 font-mono text-[10px]">
              {response.executionTrace.map((t, idx) => {
                const isError = t.status.toUpperCase() === 'ERROR' || t.status.toUpperCase() === 'FAILED';
                const isSuccess = t.status.toUpperCase() === 'SUCCESS' || t.status.toUpperCase().includes('COMPLETED');
                const isWarning = t.status.toUpperCase() === 'WARNING';

                return (
                  <div key={idx} className="flex flex-col gap-0.5 border-b border-slate-900/80 pb-1.5 last:border-b-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                          isSuccess
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : isError
                            ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                            : isWarning
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                            : 'bg-indigo-950 text-indigo-400 border border-indigo-800/60'
                        }`}
                      >
                        {t.status}
                      </span>
                      <span className="text-slate-300 font-semibold truncate">{t.step}</span>
                    </div>
                    {t.details && (
                      <span className="text-slate-500 pl-4 truncate">{t.details}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
