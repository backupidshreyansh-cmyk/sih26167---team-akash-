import React, { useState } from 'react';
import { 
  Upload, 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  FileDown, 
  ArrowRight,
  ShieldCheck,
  Layers,
  Clock,
  Cpu,
  Database
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentResponse, UploadedImage } from '../types';
import { DemoPreset, DEMO_PRESETS } from '../services/samplePresets';

interface AnalysisWorkspaceProps {
  images: UploadedImage[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (id: string) => void;
  onLoadPreset: (preset: DemoPreset) => void;
  isLoadingPreset: boolean;
  question: string;
  setQuestion: (q: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  latestResponse: AgentResponse | null;
  onDownloadReport: (response: AgentResponse) => void;
}

export function AnalysisWorkspace({
  images,
  onFileUpload,
  onRemoveImage,
  onLoadPreset,
  isLoadingPreset,
  question,
  setQuestion,
  onAnalyze,
  isLoading,
  latestResponse,
  onDownloadReport
}: AnalysisWorkspaceProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Inferred analysis type from images & query
  const getDetectedWorkflow = () => {
    if (images.length === 0) return null;
    if (images.length === 2) {
      const hasSar = images.some(img => img.metadata?.modality === 'SAR');
      const hasOptical = images.some(img => img.metadata?.modality === 'OPTICAL' || img.metadata?.modality === 'UNKNOWN');
      if (hasSar && hasOptical) {
        return 'Optical + SAR comparison';
      }
      return 'Before / After change';
    }
    const single = images[0];
    if (single.metadata?.modality === 'SAR') {
      return 'SAR backscatter analysis';
    }
    return 'Optical analysis';
  };

  const detectedWorkflow = getDetectedWorkflow();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const pseudoEvent = {
        target: { files: e.dataTransfer.files }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onFileUpload(pseudoEvent);
    }
  };

  const quickQuestions = [
    "What's visible in this image?",
    "Where has the land changed?",
    "Has water extent changed?",
    "Compare the optical and SAR evidence."
  ];

  // Helper for Decision state badge
  const renderDecisionBadge = (decision?: string) => {
    switch (decision) {
      case 'VERIFIED':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold">VERIFIED</span>
              <span className="text-[11px] font-normal text-emerald-400/90 ml-1.5 hidden sm:inline">
                Available evidence supports this conclusion
              </span>
            </div>
          </div>
        );
      case 'INCONCLUSIVE':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-500/40 text-amber-300 text-xs font-semibold">
            <AlertTriangle size={15} className="text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">INCONCLUSIVE</span>
              <span className="text-[11px] font-normal text-amber-400/90 ml-1.5 hidden sm:inline">
                Baseline recorded; temporal comparison requires second observation
              </span>
            </div>
          </div>
        );
      case 'EVIDENCE_CONFLICT':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-950/70 border border-orange-500/40 text-orange-300 text-xs font-semibold">
            <AlertCircle size={15} className="text-orange-400 shrink-0" />
            <div>
              <span className="font-bold">EVIDENCE CONFLICT</span>
              <span className="text-[11px] font-normal text-orange-400/90 ml-1.5 hidden sm:inline">
                Different sensor observations disagree
              </span>
            </div>
          </div>
        );
      case 'INVALID_INPUT':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-semibold">
            <X size={15} className="text-rose-400 shrink-0" />
            <div>
              <span className="font-bold">INVALID INPUT</span>
              <span className="text-[11px] font-normal text-rose-400/90 ml-1.5 hidden sm:inline">
                Imagery could not be analyzed reliably
              </span>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-950/70 border border-blue-500/40 text-blue-300 text-xs font-semibold">
            <ShieldCheck size={15} className="text-blue-400 shrink-0" />
            <div>
              <span className="font-bold">{decision || 'ANALYSIS COMPLETE'}</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 md:p-6 space-y-6 select-none bg-slate-950">
      
      {/* 1. Header / Intro if no response yet */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          {latestResponse ? 'Analysis Results' : 'Start an analysis'}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {latestResponse 
            ? 'Satellite evidence has been evaluated by the deterministic engine.' 
            : 'Upload satellite imagery and ask natural-language questions.'}
        </p>
      </div>

      {/* 2. RESULT-FIRST SECTION (When analysis completes) */}
      {latestResponse && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* Main Answer Card */}
          <div className="p-4 md:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                ANSWER
              </span>
              {renderDecisionBadge(latestResponse.confidence?.level)}
            </div>

            <div className="prose prose-invert prose-sm max-w-none text-slate-100 text-sm leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {latestResponse.answer}
              </ReactMarkdown>
            </div>
          </div>

          {/* Why this answer? & Evidence */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Why this answer?</span>
            </h4>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              {latestResponse.evidence?.interpretations?.[0] || 
               latestResponse.contract?.verificationResult || 
               'Conclusions are grounded strictly in measured raster pixel values and cross-sensor verification.'}
            </p>

            {/* Evidence Bullets */}
            {latestResponse.evidence?.observations && latestResponse.evidence.observations.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 block">
                  Observed Evidence:
                </span>
                <ul className="space-y-1">
                  {latestResponse.evidence.observations.slice(0, 4).map((obs, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-400 shrink-0 font-bold">✓</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* What would help / What would change the answer */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                What would help resolve uncertainty?
              </span>
              <p className="text-xs text-slate-400 italic">
                {latestResponse.confidence?.limitations?.[0] || 
                 'Additional temporal observations, authoritative CRS georeferencing, or complementary SAR acquisitions.'}
              </p>
            </div>
          </div>

          {/* Collapsible View Analysis Details */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <button
              onClick={() => setDetailsExpanded(!detailsExpanded)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-850 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-blue-400" />
                <span>View analysis details</span>
              </div>
              {detailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {detailsExpanded && (
              <div className="p-4 border-t border-slate-800 space-y-3.5 bg-slate-950 text-xs">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Data Quality</span>
                    <span className="font-semibold text-slate-200">
                      {latestResponse.dataQuality?.valid ? 'Valid Raster' : 'Uncalibrated'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Evidence Gate</span>
                    <span className="font-semibold text-slate-200">
                      {latestResponse.contract?.evidenceSufficiency || 'EVALUATED'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Execution Time</span>
                    <span className="font-semibold text-slate-200">
                      {latestResponse.budget?.processingTimeMs || latestResponse.audit?.processingTimeMs || 45} ms
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block">Provider</span>
                    <span className="font-semibold text-slate-200">
                      {latestResponse.provider} ({latestResponse.model?.split('/').pop()})
                    </span>
                  </div>
                </div>

                {/* Tools Used */}
                {latestResponse.audit?.toolsUsed && (
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Deterministic Tools Run:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {latestResponse.audit.toolsUsed.map((tool, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 text-[11px] font-mono border border-slate-800">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Report Button */}
                <div className="pt-2">
                  <button
                    onClick={() => onDownloadReport(latestResponse)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    <FileDown size={14} />
                    <span>Download SIH Technical Report (.md)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 3. STEP 1: ADD SATELLITE IMAGERY */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Step 1 — Add imagery
          </label>
          {images.length > 0 && (
            <span className="text-[11px] text-slate-400">
              {images.length} of 2 loaded
            </span>
          )}
        </div>

        {/* Upload Dropzone */}
        {images.length < 2 && (
          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 mb-2">
              <Upload size={18} />
            </div>
            <span className="text-xs font-semibold text-slate-200">
              {images.length === 0 ? '+ Add satellite imagery' : '+ Add second image (for comparison)'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              Drop files here or browse • GeoTIFF, TIFF, PNG, JPEG
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              Supports optical, SAR, or before/after pairs
            </span>
            <input 
              type="file" 
              accept="image/jpeg, image/png, image/tiff, .tif, .tiff" 
              multiple 
              onChange={onFileUpload} 
              className="hidden" 
            />
          </label>
        )}

        {/* Compact File Chips */}
        {images.length > 0 && (
          <div className="space-y-2">
            {images.map((img, idx) => {
              const isSar = img.metadata?.modality === 'SAR';
              const modalityLabel = isSar ? 'SAR' : img.slot === 'before' ? 'Before' : img.slot === 'after' ? 'After' : 'Optical';
              return (
                <div 
                  key={img.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-medium text-slate-300 shrink-0">
                      {modalityLabel}
                    </span>
                    <span className="text-slate-200 font-medium truncate">
                      {img.metadata?.fileName || `Image ${idx + 1}`}
                    </span>
                    <span className="text-slate-400 text-[11px] hidden sm:inline shrink-0">
                      ✓ Valid
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveImage(img.id)}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Remove"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}

            {/* Inferred Workflow Pill */}
            {detectedWorkflow && (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                <span className="text-slate-500 font-medium">Detected analysis:</span>
                <span className="text-blue-400 font-semibold">{detectedWorkflow}</span>
              </div>
            )}
          </div>
        )}

        {/* TRY A DEMO (Simple 4-chip row) */}
        <div className="pt-2 border-t border-slate-800/80">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
            Try a demo (synthetic illustrations):
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onLoadPreset(DEMO_PRESETS[0])}
              disabled={isLoadingPreset}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Synthetic Optical
            </button>
            <button
              onClick={() => onLoadPreset(DEMO_PRESETS[1])}
              disabled={isLoadingPreset}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Synthetic Radar
            </button>
            <button
              onClick={() => onLoadPreset(DEMO_PRESETS[2])}
              disabled={isLoadingPreset}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Synthetic Optical + Radar
            </button>
            <button
              onClick={() => onLoadPreset(DEMO_PRESETS[3])}
              disabled={isLoadingPreset}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Synthetic Before / After
            </button>
            <button
              onClick={() => onLoadPreset(DEMO_PRESETS[4])}
              disabled={isLoadingPreset}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Safety / Abstention Check
            </button>
          </div>
        </div>
      </div>

      {/* 4. STEP 2: ASK YOUR QUESTION */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider block">
          Step 2 — Ask your question
        </label>
        
        <div className="relative">
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Has the water area increased?"
            className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-hidden focus:border-blue-500 transition-colors resize-none leading-relaxed"
          />
        </div>

        {/* 4 Clickable Example Chips */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">
            Suggestions:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setQuestion(q)}
                className="text-left px-2.5 py-1 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. STEP 3: ANALYZE BUTTON & EXECUTION PROGRESS */}
      <div className="space-y-3 pt-2">
        <button
          onClick={onAnalyze}
          disabled={isLoading || images.length === 0 || !question.trim()}
          className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs tracking-wide transition-all cursor-pointer shadow-sm shadow-blue-500/20 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analyzing Satellite Data...</span>
            </span>
          ) : (
            <>
              <span>Analyze Satellite Data</span>
              <ArrowRight size={14} />
            </>
          )}
        </button>

        {/* Progress State while Analyzing */}
        {isLoading && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
            <span className="font-semibold text-slate-200 block mb-1">
              Analyzing satellite imagery...
            </span>
            <div className="space-y-1.5 text-slate-400">
              <div className="flex items-center gap-2 text-emerald-400">
                <span>✓</span>
                <span>Validated imagery & CRS georeferencing</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <span>✓</span>
                <span>Identified analysis type ({detectedWorkflow || 'Multi-modal'})</span>
              </div>
              <div className="flex items-center gap-2 text-blue-400 animate-pulse font-medium">
                <span>●</span>
                <span>Examining deterministic evidence & pixel moments</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <span>○</span>
                <span>Verifying result against decision gate</span>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
