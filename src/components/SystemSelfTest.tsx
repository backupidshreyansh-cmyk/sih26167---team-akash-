import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface SystemSelfTestProps {
  isOpen?: boolean;
  onClose?: () => void;
  showTriggerButton?: boolean;
}

export function SystemSelfTest({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  showTriggerButton = false
}: SystemSelfTestProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const isModalOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleClose = controlledOnClose || (() => setInternalIsOpen(false));

  const runTest = async () => {
    setIsRunning(true);
    setResults([]);
    try {
      const res = await fetch('/api/system/self-test');
      const data = await res.json();
      setResults(data.results || []);
    } catch (e: any) {
      setResults([
        {
          id: 'error',
          category: 'SYSTEM',
          name: 'System Connectivity',
          status: 'FAIL',
          message: e.message
        }
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  // Automatically run test when modal opens if no results yet
  useEffect(() => {
    if (isModalOpen && results.length === 0 && !isRunning) {
      runTest();
    }
  }, [isModalOpen]);

  // Group results by category
  const categories = [
    'PROBLEM COVERAGE',
    'RELIABILITY',
    'ENGINEERING',
    'AI',
    'AUDITABILITY',
    'DEMO'
  ];

  return (
    <>
      {showTriggerButton && (
        <button
          onClick={() => setInternalIsOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded transition-colors"
        >
          <Shield size={14} /> SIH Judge Dashboard
        </button>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Shield size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    SIH-26167 Automated Compliance Audit
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Evaluation of Remote-Sensing VLM Capabilities
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1 text-slate-500 hover:text-slate-300 rounded-lg transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Test Results Grid */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-950/50">
              {results.length === 0 && !isRunning ? (
                <div className="text-center py-12 text-slate-400">
                  <Shield size={48} className="mx-auto mb-3 opacity-20 text-emerald-400" />
                  <h3 className="text-sm font-medium text-slate-300 mb-1">
                    SIH-26167 Compliance Engine
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click 'Start Audit' below to execute the verification suite.
                  </p>
                </div>
              ) : null}

              {isRunning ? (
                <div className="text-center py-16 text-indigo-400 flex flex-col items-center gap-3">
                  <Loader2 size={36} className="animate-spin text-emerald-400" />
                  <p className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300">
                    Executing SIH-26167 Automated Verification Suite...
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map((cat) => {
                    const catResults = results.filter((r) => r.category === cat);
                    if (catResults.length === 0) return null;
                    return (
                      <div
                        key={cat}
                        className="space-y-2 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80"
                      >
                        <h3 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 flex items-center justify-between">
                          <span>{cat}</span>
                          <span className="text-slate-500">
                            {catResults.filter((r) => r.status === 'PASS').length}/{catResults.length} PASS
                          </span>
                        </h3>
                        <div className="space-y-2">
                          {catResults.map((r) => (
                            <div
                              key={r.id}
                              className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 flex items-start gap-2.5"
                            >
                              {r.status === 'PASS' ? (
                                <CheckCircle
                                  size={15}
                                  className="text-emerald-400 shrink-0 mt-0.5"
                                />
                              ) : r.status === 'FAIL' ? (
                                <XCircle
                                  size={15}
                                  className="text-rose-400 shrink-0 mt-0.5"
                                />
                              ) : (
                                <AlertTriangle
                                  size={15}
                                  className="text-amber-400 shrink-0 mt-0.5"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-semibold text-slate-200 truncate">
                                  {r.name}
                                </h4>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed font-sans">
                                  {r.message}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">
                SatQuery AI • Problem Statement 26167
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={runTest}
                  disabled={isRunning}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow"
                >
                  {isRunning ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Shield size={13} />
                  )}
                  <span>{results.length > 0 ? 'Rerun Audit' : 'Start Audit'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
