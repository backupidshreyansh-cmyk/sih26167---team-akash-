import React from 'react';
import { XCircle, FileText, Database, ShieldAlert, Sparkles } from 'lucide-react';

interface SpecificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  specification: string;
  setSpecification: (spec: string) => void;
}

export const SpecificationModal: React.FC<SpecificationModalProps> = ({
  isOpen,
  onClose,
  specification,
  setSpecification
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                ISRO SIH-26167 System Specification & Constraints
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                SatQuery AI Operational Architecture & Decision Rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-300 rounded-lg transition-colors"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col space-y-3">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-900/50 text-xs text-indigo-300">
            <Sparkles size={15} className="shrink-0 text-amber-400" />
            <span>
              The agent evaluates all multi-modal visual observations strictly against these evidence grounding rules.
            </span>
          </div>

          <textarea
            value={specification}
            onChange={(e) => setSpecification(e.target.value)}
            className="flex-1 w-full min-h-[420px] p-4 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono text-xs leading-relaxed resize-none transition-colors"
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono">
            SatQuery AI • Problem Statement 26167
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow"
          >
            Save & Return to Workstation
          </button>
        </div>
      </div>
    </div>
  );
};
