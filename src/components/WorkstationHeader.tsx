import React, { useState } from 'react';
import { 
  Satellite, 
  RotateCcw, 
  Settings, 
  Wifi, 
  WifiOff, 
  FileCode,
  ShieldCheck,
  CheckCircle2,
  X
} from 'lucide-react';
import { SystemSelfTest } from './SystemSelfTest';

interface WorkstationHeaderProps {
  aiMode: 'auto' | 'online' | 'offline';
  onChangeAiMode: (mode: 'auto' | 'online' | 'offline') => void;
  systemHealth: {
    gemini?: { configured: boolean; available: boolean; model: string };
    ollama?: { available: boolean; model: string };
    offlineReady?: boolean;
    onlineReady?: boolean;
  };
  healthStatus: 'checking' | 'available' | 'unavailable';
  sessionId: string;
  onResetSession: () => void;
  onOpenSpecModal: () => void;
  onOpenSemanticSearch?: () => void;
  onOpenDiscovery?: () => void;
  onOpenEvaluation?: () => void;
  isBiTemporalAvailable?: boolean;
  activeWorkspaceView?: 'workstation' | 'temporal-lab' | 'review';
  onChangeWorkspaceView?: (view: 'workstation' | 'temporal-lab' | 'review') => void;
  pendingReviewCount?: number;
}

export function WorkstationHeader({
  aiMode,
  onChangeAiMode,
  systemHealth,
  healthStatus,
  onResetSession,
  onOpenSpecModal,
  onOpenSemanticSearch,
  onOpenDiscovery,
  onOpenEvaluation,
  isBiTemporalAvailable,
  activeWorkspaceView = 'workstation',
  onChangeWorkspaceView,
  pendingReviewCount = 2
}: WorkstationHeaderProps) {
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const isOnlineActive = aiMode === 'online' || (aiMode === 'auto' && systemHealth.gemini?.available);
  const isOfflineActive = aiMode === 'offline' || (aiMode === 'auto' && !systemHealth.gemini?.available && systemHealth.ollama?.available);
  const isReady = healthStatus === 'available' || isOnlineActive || isOfflineActive;

  return (
    <header className="bg-slate-950 border-b border-slate-800/80 px-4 py-2.5 shrink-0 z-30 select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Left: Clean Brand & Core Principle */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Satellite size={16} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-tight text-white font-sans">
              SATQUERY AI <span className="text-slate-500 font-normal text-xs">/ ORBITAL EYE</span>
            </span>
            <span className="text-xs text-slate-400 hidden lg:inline">
              Evidence-driven satellite intelligence (SIH 2026 PS 26227)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 hidden sm:inline">
              LOCAL • OFFLINE READY
            </span>
          </div>
        </div>

        {/* Center: Workspace Navigation (Workstation vs Multi-Temporal Lab) */}
        <div className="hidden md:flex items-center gap-2">
          {onChangeWorkspaceView && (
            <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => onChangeWorkspaceView('workstation')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  activeWorkspaceView === 'workstation'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Workstation &amp; VQA
              </button>

              <button
                type="button"
                onClick={() => onChangeWorkspaceView('temporal-lab')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeWorkspaceView === 'temporal-lab'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Multi-Temporal Lab</span>
                {isBiTemporalAvailable && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onChangeWorkspaceView('review')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeWorkspaceView === 'review'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Analyst Review</span>
                {pendingReviewCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full font-bold">
                    {pendingReviewCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Dedicated Semantic Retrieval Action */}
          {onOpenSemanticSearch && (
            <button
              type="button"
              onClick={onOpenSemanticSearch}
              className="px-2.5 py-1 rounded-lg bg-blue-950/80 hover:bg-blue-900/80 text-blue-300 hover:text-blue-100 border border-blue-800/80 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
              title="Search ISRO & Copernicus Satellite Archives with Natural Language"
            >
              <span>🔍 Semantic</span>
            </button>
          )}

          {/* Similar-Site Discovery Action */}
          {onOpenDiscovery && (
            <button
              type="button"
              onClick={onOpenDiscovery}
              className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 hover:text-cyan-100 border border-cyan-800/80 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
              title="Embedding-based grouping & similar-site discovery"
            >
              <span>🌐 Discovery</span>
            </button>
          )}

          {/* System Diagnostics & Benchmark Action */}
          {onOpenEvaluation && (
            <button
              type="button"
              onClick={onOpenEvaluation}
              className="px-2.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900/80 text-purple-300 hover:text-purple-100 border border-purple-800/80 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
              title="Capability Matrix & Reproducible Latency Benchmarks"
            >
              <span>📊 Eval</span>
            </button>
          )}
        </div>

        {/* Right: Status Indicator & Technical Settings Dialog */}
        <div className="flex items-center gap-2">
          
          {/* Mobile Semantic Retrieval button */}
          {onOpenSemanticSearch && (
            <button
              type="button"
              onClick={onOpenSemanticSearch}
              className="md:hidden p-1.5 text-blue-400 bg-blue-950/60 border border-blue-800/60 rounded-md transition-colors cursor-pointer"
              title="Semantic Retrieval"
            >
              🔍
            </button>
          )}
          
          {/* Status Dot */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-slate-400 font-mono">
            <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span>{isReady ? 'READY' : 'CHECKING'}</span>
          </div>

          {/* Technical Details & Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 rounded-md transition-colors cursor-pointer"
            title="Technical & Reproducibility Settings"
          >
            <Settings size={15} />
          </button>

          {/* Reset Workspace */}
          <button
            onClick={onResetSession}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 rounded-md transition-colors cursor-pointer"
            title="Reset Workspace"
          >
            <RotateCcw size={15} />
          </button>
        </div>

      </div>

      {/* Technical / Reproducibility Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-4 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Technical &amp; Reproducibility Settings
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Inference Provider Selection (Housed in Settings, not main UI) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-300 block">
                Vision-Language Inference Provider:
              </span>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => onChangeAiMode('auto')}
                  className={`py-1.5 px-2 rounded text-center font-medium transition-colors cursor-pointer ${
                    aiMode === 'auto' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Auto
                </button>
                <button
                  onClick={() => onChangeAiMode('online')}
                  className={`py-1.5 px-2 rounded text-center font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                    aiMode === 'online' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Wifi size={12} />
                  <span>Cloud (Gemini)</span>
                </button>
                <button
                  onClick={() => onChangeAiMode('offline')}
                  className={`py-1.5 px-2 rounded text-center font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                    aiMode === 'offline' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <WifiOff size={12} />
                  <span>Local (Ollama)</span>
                </button>
              </div>
            </div>

            {/* EO Specialist Models Status */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 text-xs">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Specialist Earth Observation Foundation Models
              </span>
              <div className="flex items-center justify-between text-slate-300 pt-0.5">
                <span>Prithvi-EO-2.0 (IBM/NASA/Jülich):</span>
                <span className="text-amber-400 font-mono text-[11px]">Optional / Local Checkpoint</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                Configured via PRITHVI_MODEL_ENDPOINT. Gracefully falls back to deterministic remote sensing engine if unavailable.
              </p>
            </div>

            {/* Official System Specification */}
            <div className="pt-1">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  onOpenSpecModal();
                }}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              >
                <FileCode size={13} className="text-blue-400" />
                <span>View Official System Specification (SIH-26167)</span>
              </button>
            </div>

            {/* System Self-Test Verification Suite */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block mb-1.5">
                Automated Verification Suite
              </span>
              <SystemSelfTest showTriggerButton={true} />
            </div>

          </div>
        </div>
      )}
    </header>
  );
}
