import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  AlertCircle, 
  ShieldCheck, 
  ShieldAlert, 
  Layers, 
  HelpCircle, 
  Maximize2, 
  Cpu, 
  CheckCircle2, 
  FileQuestion, 
  Columns, 
  Radio, 
  ArrowRight,
  Target,
  FileDown,
  Info,
  Clock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentResponse, Message, UploadedImage } from '../types';

interface IntelligenceConsoleProps {
  messages: Message[];
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  isLoading: boolean;
  error: string | null;
  images: UploadedImage[];
  analysisMode: string;
  setAnalysisMode: (mode: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  viewportMode: 'single' | 'split';
  activeImageIndex: number;
  showGroundingBoxes: boolean;
  onSelectSuggestion: (query: string) => void;
  onDownloadReport: (response: AgentResponse) => void;
  hideVisualCanvas?: boolean;
  onSwitchToAudit?: () => void;
}

export const IntelligenceConsole: React.FC<IntelligenceConsoleProps> = ({
  messages,
  inputMessage,
  setInputMessage,
  isLoading,
  error,
  images,
  analysisMode,
  setAnalysisMode,
  onSendMessage,
  viewportMode,
  activeImageIndex,
  showGroundingBoxes,
  onSelectSuggestion,
  onDownloadReport,
  hideVisualCanvas = false,
  onSwitchToAudit
}) => {
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const latestModelMessage = [...messages].reverse().find(m => m.role === 'model' && m.agentResponse);
  const latestResponse = latestModelMessage?.agentResponse;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Context-aware query suggestion chips
  const getSuggestions = () => {
    if (images.length === 0) {
      return [
        "What are the capabilities of the SatQuery AI remote-sensing engine?",
        "How does SatQuery AI distinguish optical reflectance from SAR backscatter?",
        "Explain the minimum-sufficient evidence principle in remote-sensing analysis."
      ];
    }
    if (images.length === 2 && analysisMode === 'bi-temporal') {
      return [
        "Detect and delineate flood inundation changes between T1 (Before) and T2 (After).",
        "Distinguish true physical land-use change from seasonal and illumination artifacts.",
        "Assess damage to transportation infrastructure and agricultural parcels."
      ];
    }
    if (images.length === 2 && (analysisMode === 'optical-sar' || analysisMode === 'auto')) {
      return [
        "Compare optical reflectance against SAR backscatter to verify structural presence.",
        "What complementary evidence do optical and radar sensors provide for this sector?",
        "Verify if SAR double-bounce confirms apparent optical built-up features."
      ];
    }
    const isSar = images[0]?.file.name.toLowerCase().includes('sar');
    if (isSar) {
      return [
        "Analyze radar backscatter intensity, specular reflection, and double-bounce returns.",
        "Identify maritime targets and rough water surfaces in this SAR observation.",
        "What are the sensor limitations of this single-polarization SAR image?"
      ];
    }
    return [
      "Describe visible land-cover classes and ground maritime vessels with bounding boxes.",
      "Identify road networks, docks, and urban vegetation in this optical observation.",
      "What are the spatial resolution constraints and cloud-cover limitations?"
    ];
  };

  const getDecisionBadge = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'VERIFIED':
      case 'HIGH':
        return {
          label: 'VERIFIED',
          color: 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50',
          dot: 'bg-emerald-400',
          desc: 'High Evidence Sufficiency — Physical observables corroborate claim.'
        };
      case 'INCONCLUSIVE':
        return {
          label: 'INCONCLUSIVE',
          color: 'bg-amber-950/80 text-amber-400 border-amber-500/50',
          dot: 'bg-amber-400',
          desc: 'Indeterminate — Visual features are insufficient to confirm or refute.'
        };
      case 'NEEDS_MORE_EVIDENCE':
      case 'NEEDS MORE EVIDENCE':
        return {
          label: 'NEEDS MORE EVIDENCE',
          color: 'bg-cyan-950/80 text-cyan-400 border-cyan-500/50',
          dot: 'bg-cyan-400',
          desc: 'Additional Sensor Modality or Higher-Resolution Raster Required.'
        };
      case 'CONFLICTING EVIDENCE':
      case 'EVIDENCE CONFLICT':
        return {
          label: 'EVIDENCE CONFLICT',
          color: 'bg-rose-950/80 text-rose-400 border-rose-500/50',
          dot: 'bg-rose-400',
          desc: 'Sensor Disagreement — Optical and SAR observations contradict each other.'
        };
      case 'INVALID INPUT':
      case 'UNSUPPORTED':
        return {
          label: 'INVALID INPUT',
          color: 'bg-red-950/80 text-red-400 border-red-500/50',
          dot: 'bg-red-400',
          desc: 'Corrupt raster, missing inputs, or out-of-scope query format.'
        };
      default:
        return {
          label: level || 'EVALUATING',
          color: 'bg-slate-900 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
          desc: 'Standard remote sensing assessment.'
        };
    }
  };

  const currentBadge = getDecisionBadge(latestResponse?.confidence.level);

  return (
    <main className="flex-1 flex flex-col bg-slate-950 min-w-0 h-full overflow-hidden select-none">
      {/* Top Console Toolbar */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-indigo-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Interactive Intelligence Console
            </h2>
          </div>

          {/* Analysis Workflow Mode */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono uppercase font-semibold">
              Mode:
            </span>
            <select
              value={analysisMode}
              onChange={(e) => setAnalysisMode(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 text-slate-200 text-xs rounded-lg px-2.5 py-1 outline-none focus:border-indigo-500 font-medium"
            >
              <option value="auto">Auto-Detect Modality</option>
              <option value="single">Single-Image VQA</option>
              <option value="optical-sar">Cross-Modal (Optical + SAR)</option>
              <option value="bi-temporal">Bi-Temporal (T1 + T2 Change)</option>
            </select>
          </div>
        </div>

        {/* Live Decision Gate Badge and Audit Switcher in Header */}
        <div className="flex items-center gap-2">
          {latestResponse && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-mono font-bold tracking-wider ${currentBadge.color}`}>
              <span className={`w-2 h-2 rounded-full ${currentBadge.dot} animate-ping`}></span>
              <span>DECISION GATE: {currentBadge.label}</span>
            </div>
          )}

          {onSwitchToAudit && latestResponse && (
            <button
              onClick={onSwitchToAudit}
              className="text-xs font-mono font-semibold text-cyan-300 hover:text-white flex items-center gap-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.15)]"
              title="Inspect evidence graph, token telemetry, and routing logic"
            >
              <ShieldCheck size={13} className="text-cyan-400" />
              <span>Evidence Graph & Telemetry →</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport & Output Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Active Imagery & Visual Grounding Canvas (if images loaded and not hidden) */}
        {!hideVisualCanvas && images.length > 0 && (
          <section className="bg-slate-900/80 rounded-2xl border border-slate-800/90 shadow-xl overflow-hidden">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target size={15} className="text-cyan-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Visual Grounding & Sensor Canvas
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <span>Viewport: {viewportMode === 'split' ? 'SPLIT (T1 vs T2 / Opt vs SAR)' : `SLOT ${activeImageIndex + 1}`}</span>
              </div>
            </div>

            {/* Canvas View */}
            <div className="p-4 bg-slate-950 flex flex-col items-center justify-center">
              {viewportMode === 'split' && images.length === 2 ? (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                  {images.map((img, idx) => (
                    <div key={img.id} className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-md">
                      <div className="absolute top-2 left-2 z-10 bg-slate-950/80 backdrop-blur-sm text-[10px] font-mono font-bold text-cyan-300 px-2 py-0.5 rounded border border-slate-800">
                        {idx === 0 ? 'IMAGE 1: PRIMARY / BEFORE (OPTICAL)' : 'IMAGE 2: SECONDARY / AFTER (SAR)'}
                      </div>
                      <img src={img.previewUrl} alt={img.file.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative inline-block max-w-2xl w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-lg">
                  {images[activeImageIndex] && (
                    <div className="relative">
                      <img
                        src={images[activeImageIndex].previewUrl}
                        alt="Active Raster"
                        className="w-full h-auto block select-none"
                      />

                      {/* Grounding Bounding Box Overlays */}
                      {showGroundingBoxes && latestResponse?.groundingBoxes && latestResponse.groundingBoxes.length > 0 && (
                        latestResponse.groundingBoxes.map((box, bIdx) => {
                          const isHovered = selectedBoxIndex === bIdx;
                          return (
                            <div
                              key={bIdx}
                              onMouseEnter={() => setSelectedBoxIndex(bIdx)}
                              onMouseLeave={() => setSelectedBoxIndex(null)}
                              className={`absolute border-2 transition-all cursor-pointer ${
                                isHovered
                                  ? 'border-amber-400 bg-amber-400/25 z-20'
                                  : 'border-emerald-400 bg-emerald-400/15 z-10'
                              }`}
                              style={{
                                top: `${box.ymin * 100}%`,
                                left: `${box.xmin * 100}%`,
                                width: `${(box.xmax - box.xmin) * 100}%`,
                                height: `${(box.ymax - box.ymin) * 100}%`
                              }}
                            >
                              <div
                                className={`absolute -top-5 left-0 text-[10px] font-mono font-bold px-1.5 py-0.5 whitespace-nowrap rounded-t-sm shadow ${
                                  isHovered ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500 text-slate-950'
                                }`}
                              >
                                #{bIdx + 1}: {box.label}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Grounded Entities Legend Table */}
              {latestResponse?.groundingBoxes && latestResponse.groundingBoxes.length > 0 && (
                <div className="w-full mt-4 bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Target size={12} className="text-emerald-400" />
                      Grounded Entities ({latestResponse.groundingBoxes.length} verified objects)
                    </span>
                    <span className="text-[9px] font-mono text-emerald-400">COORDINATES: NORMALIZED [0-1000]</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {latestResponse.groundingBoxes.map((box, bIdx) => (
                      <div
                        key={bIdx}
                        onMouseEnter={() => setSelectedBoxIndex(bIdx)}
                        onMouseLeave={() => setSelectedBoxIndex(null)}
                        className={`p-2 rounded-lg border text-xs font-mono transition-colors cursor-pointer flex items-center justify-between ${
                          selectedBoxIndex === bIdx
                            ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {bIdx + 1}
                          </span>
                          <span className="truncate font-semibold">{box.label}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 shrink-0 ml-1">
                          [{box.ymin.toFixed(2)}, {box.xmin.toFixed(2)}]
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Agentic Workflow Pipeline Visual Stepper */}
        {isLoading && (
          <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-5 shadow-2xl animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cpu size={18} className="text-indigo-400 animate-spin" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Evidence-Driven Analysis in Progress
                </h3>
              </div>
              <span className="text-[10px] font-mono text-indigo-400">AGENTIC ORCHESTRATION</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-[10px] font-mono">
              <div className="p-2 rounded bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
                1. Input Validation
              </div>
              <div className="p-2 rounded bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
                2. Task Decomposition
              </div>
              <div className="p-2 rounded bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
                3. Min-Evidence Plan
              </div>
              <div className="p-2 rounded bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
                4. Specialist Dispatch
              </div>
              <div className="p-2 rounded bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
                5. Feature Extraction
              </div>
              <div className="p-2 rounded bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
                6. Cross-Arbitration
              </div>
              <div className="p-2 rounded bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
                7. Decision Gate
              </div>
            </div>
          </div>
        )}

        {/* Latest Intelligence Output */}
        {latestResponse && (
          <article className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            {/* Header: Task Classification & Modality */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 uppercase tracking-wider">
                  TASK: {latestResponse.taskClassification}
                </span>

                {latestResponse.provider && (
                  <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    ENGINE: {latestResponse.provider} ({latestResponse.model})
                  </span>
                )}
              </div>

              {/* Download Report Button */}
              <button
                onClick={() => onDownloadReport(latestResponse)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-800/60 rounded-lg transition-colors shadow-sm"
              >
                <FileDown size={14} />
                <span>Export Intelligence Report</span>
              </button>
            </div>

            {/* Decision Gate Banner */}
            <div className={`p-4 border-b ${currentBadge.color} flex items-start gap-3`}>
              <div className="p-1 rounded bg-slate-950/50 mt-0.5">
                <ShieldCheck size={18} className="shrink-0" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider">
                    DECISION GATE STATUS: {currentBadge.label}
                  </span>
                </div>
                <p className="text-xs mt-1 text-slate-300 leading-relaxed font-sans">
                  {currentBadge.desc}
                </p>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Executive Answer */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Info size={13} className="text-cyan-400" />
                  Executive Intelligence Brief
                </h4>
                <div className="prose prose-sm prose-invert max-w-none text-slate-200 leading-relaxed bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 font-sans">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {latestResponse.answer}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Sensory Observations vs Analyst Interpretations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: Sensory Observations */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Target size={14} />
                      Sensor Observations (Physical Evidence)
                    </h5>
                    <span className="text-[9px] font-mono text-slate-500">RAW OBSERVABLES</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-2">
                    {latestResponse.evidence.observations?.map((obs, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">{obs}</span>
                      </li>
                    ))}
                    {(!latestResponse.evidence.observations || latestResponse.evidence.observations.length === 0) && (
                      <li className="text-slate-500 italic">No discrete physical observations cataloged.</li>
                    )}
                  </ul>
                </div>

                {/* Column 2: Analyst Interpretations */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <Sparkles size={14} />
                      Analyst Interpretations (Deductions)
                    </h5>
                    <span className="text-[9px] font-mono text-slate-500">SYNTHESIZED INFERENCE</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-2">
                    {latestResponse.evidence.interpretations?.map((int, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">{int}</span>
                      </li>
                    ))}
                    {(!latestResponse.evidence.interpretations || latestResponse.evidence.interpretations.length === 0) && (
                      <li className="text-slate-500 italic">No higher-order interpretations derived.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Falsifiability & Sensor Caveats */}
              <div className="bg-slate-950/90 rounded-xl border border-amber-900/40 p-4 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider mb-2">
                  <FileQuestion size={15} />
                  <span>Falsifiability & Operational Limitations</span>
                </div>
                <p className="text-slate-400 mb-2 italic">
                  Conditions or additional sensor observations that would modify or falsify this intelligence finding:
                </p>
                <ul className="text-slate-300 space-y-1.5 pl-4 list-disc marker:text-amber-500">
                  {latestResponse.confidence.limitations?.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                  {(!latestResponse.confidence.limitations || latestResponse.confidence.limitations.length === 0) && (
                    <>
                      <li>Acquisition of higher ground sampling distance (GSD &lt; 2m).</li>
                      <li>Acquisition of cross-polarized SAR (VH / HV) to isolate volume scattering.</li>
                      <li>Multi-temporal observation to filter transient seasonal illumination.</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </article>
        )}

        {/* Empty State / Welcome */}
        {!latestResponse && !isLoading && (
          <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80 my-8">
            <Radio size={36} className="text-indigo-400 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-slate-200 mb-1">
              SatQuery AI Intelligence Station Ready
            </h3>
            <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
              Select one of the <strong className="text-slate-300">Pre-Flight Demo Missions</strong> in the left panel, or ingest your own remote-sensing rasters (Optical, SAR, or Bi-Temporal pairs) to execute evidence-grounded inference.
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Query Bar & Suggestions (Fixed to Bottom) */}
      <footer className="p-4 border-t border-slate-800/90 bg-slate-900/90 shrink-0">
        {/* Error Notification */}
        {error && (
          <div className="mb-3 p-3 rounded-xl border border-red-900/50 bg-red-950/60 text-red-400 text-xs flex items-start gap-2 shadow-lg">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Inference Exception:</span>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Remote Sensing Mission Suggestions */}
        <div className="mb-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono font-semibold uppercase mb-1.5">
            <Sparkles size={11} className="text-amber-400" />
            <span>Recommended RS Inquiries</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {getSuggestions().map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSelectSuggestion(suggestion)}
                className="text-[11px] font-medium text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/60 px-2.5 py-1 rounded-lg transition-all truncate max-w-md text-left"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={onSendMessage} className="relative">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              images.length > 0
                ? "Enter natural-language query to decompose and ground remote-sensing evidence..."
                : "Select a demo mission above or upload an image to begin..."
            }
            disabled={isLoading}
            className="w-full pl-4 pr-12 py-3.5 rounded-xl border border-slate-700/80 bg-slate-950 text-slate-200 placeholder-slate-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors text-sm shadow-inner disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || (!inputMessage.trim() && images.length === 0)}
            className="absolute right-2 top-2 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
            title="Execute Remote Sensing Analysis"
          >
            <Send size={16} />
          </button>
        </form>
      </footer>
    </main>
  );
};
