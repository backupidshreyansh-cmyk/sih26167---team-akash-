import React from 'react';
import { X, Database, Sparkles, Check, RotateCcw } from 'lucide-react';
import { OFFICIAL_SYSTEM_SPECIFICATION } from '../specification';

interface SystemSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
  specContent: string;
  onChangeSpec: (val: string) => void;
}

export function SystemSpecModal({
  isOpen,
  onClose,
  specContent,
  onChangeSpec
}: SystemSpecModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Database size={17} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono">
                SIH-26167 OPERATIONAL SYSTEM SPECIFICATION
              </h2>
              <p className="text-[10px] text-slate-400">
                Ground-Truth Remote Sensing Constraints &amp; Agent Policy Layer
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 flex flex-col overflow-hidden space-y-3 bg-slate-950">
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-start gap-2">
            <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <span>
              All agentic model calls validate observations against these operational rules. Falsifiability, cross-modal checks, minimum-sufficient evidence, and uncertainty gates are enforced here.
            </span>
          </div>

          <textarea
            value={specContent}
            onChange={(e) => onChangeSpec(e.target.value)}
            className="flex-1 w-full p-4 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-200 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs resize-none leading-relaxed"
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={() => onChangeSpec(OFFICIAL_SYSTEM_SPECIFICATION)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors font-mono"
          >
            <RotateCcw size={13} />
            <span>Reset to Official Default</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-md shadow-indigo-600/30"
          >
            <Check size={14} />
            <span>Save &amp; Apply Constraints</span>
          </button>
        </div>

      </div>
    </div>
  );
}
