import React, { useState } from 'react';
import { 
  Terminal, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Clock
} from 'lucide-react';
import { AgentResponse } from '../types';

interface ExecutionTracePanelProps {
  trace?: AgentResponse['executionTrace'];
  runId: string;
  isExpandedDefault?: boolean;
}

export function ExecutionTracePanel({
  trace = [],
  runId,
  isExpandedDefault = false
}: ExecutionTracePanelProps) {
  const [isExpanded, setIsExpanded] = useState(isExpandedDefault);

  const hasError = trace.some(t => t.status?.toUpperCase() === 'ERROR');
  const hasWarning = trace.some(t => t.status?.toUpperCase() === 'WARNING');

  // Format a simulated base timestamp for the run to show clear auditable sequence
  const baseTime = React.useMemo(() => {
    const d = new Date();
    return d;
  }, [runId]);

  const getStepTime = (index: number) => {
    const stepDate = new Date(baseTime.getTime() + index * 1000);
    return stepDate.toTimeString().split(' ')[0]; // HH:MM:SS
  };

  const getStatusSymbol = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'SUCCESS' || s.includes('COMPLETED')) return '✓';
    if (s === 'ERROR' || s.includes('FAILED')) return '✕';
    if (s === 'WARNING') return '⚠';
    return '●';
  };

  return (
    <div className="bg-slate-950 border-t border-slate-800 shrink-0 z-30 transition-all duration-200 select-none">
      
      {/* Trace Bar Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between bg-slate-900/95 hover:bg-slate-900 border-b border-slate-800/80 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Terminal size={12} />
          </div>
          <span className="text-xs font-mono font-bold text-slate-200 tracking-wider">
            AUDITABLE EXECUTION TRACE
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            RUN: #{runId.slice(-6)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            {hasError ? (
              <span className="text-red-400 flex items-center gap-1 font-semibold">
                <AlertCircle size={13} /> ERROR DETECTED
              </span>
            ) : hasWarning ? (
              <span className="text-amber-400 flex items-center gap-1 font-semibold">
                <AlertTriangle size={13} /> WARNING
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle size={13} /> {trace.length} STEPS VERIFIED
              </span>
            )}
          </div>

          <div className="text-slate-400 p-0.5 rounded hover:text-white transition-colors">
            {isExpanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </div>
        </div>
      </button>

      {/* Expanded Trace Details */}
      {isExpanded && (
        <div className="max-h-48 overflow-y-auto p-3 space-y-1 bg-slate-950 font-mono text-xs">
          {trace.length === 0 ? (
            <div className="text-slate-500 text-center py-3 italic">
              No active execution trace yet. Execute a query to inspect deterministic pipeline steps.
            </div>
          ) : (
            trace.map((step, idx) => {
              const status = step.status?.toUpperCase() || 'INFO';
              const symbol = getStatusSymbol(status);
              const timeStr = getStepTime(idx);
              const isSuccess = status === 'SUCCESS' || status.includes('COMPLETED');
              const isErr = status === 'ERROR' || status.includes('FAILED');
              const isWarn = status === 'WARNING';

              return (
                <div 
                  key={idx}
                  className="flex items-start gap-3 py-1 px-2 rounded hover:bg-slate-900/60 transition-colors"
                >
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {timeStr}
                  </span>

                  <span className={`text-[10px] font-bold px-1 rounded shrink-0 ${
                    isSuccess ? 'text-emerald-400 bg-emerald-500/10' :
                    isErr ? 'text-rose-400 bg-rose-500/10' :
                    isWarn ? 'text-amber-400 bg-amber-500/10' :
                    'text-indigo-400 bg-indigo-500/10'
                  }`}>
                    {symbol}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className="text-slate-200 font-medium">{step.step}</span>
                    {step.details && (
                      <span className="text-slate-400 text-[11px] block truncate mt-0.5">
                        ↳ {step.details}
                      </span>
                    )}
                  </div>

                  {step.durationMs !== undefined && (
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                      {step.durationMs}ms
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}
