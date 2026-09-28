import React, { useState } from 'react';
import { 
  Upload, 
  X, 
  Satellite, 
  Radio, 
  Calendar, 
  ArrowRightLeft, 
  Send, 
  Sparkles, 
  FileText, 
  Database,
  ChevronDown,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { UploadedImage, ImageSlot } from '../types';
import { SAMPLE_DATASETS, SampleDataset, loadSampleDataset } from '../data/sampleDatasets';

interface MissionInputPanelProps {
  images: UploadedImage[];
  onUploadImage: (file: File, slot: ImageSlot) => void;
  onRemoveImage: (id: string) => void;
  onClearAll: () => void;
  onLoadDataset: (dataset: SampleDataset) => void;
  analysisMode: string;
  onChangeAnalysisMode: (mode: string) => void;
  inputQuery: string;
  onChangeQuery: (query: string) => void;
  onSubmitQuery: () => void;
  isLoading: boolean;
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
}

export function MissionInputPanel({
  images,
  onUploadImage,
  onRemoveImage,
  onClearAll,
  onLoadDataset,
  analysisMode,
  onChangeAnalysisMode,
  inputQuery,
  onChangeQuery,
  onSubmitQuery,
  isLoading,
  selectedImageIndex,
  onSelectImage
}: MissionInputPanelProps) {
  const [activeTab, setActiveTab] = useState<'slots' | 'presets'>('slots');
  const [draggedOverSlot, setDraggedOverSlot] = useState<ImageSlot | null>(null);

  // Find image in specific slot
  const getImageForSlot = (slot: ImageSlot) => {
    return images.find(img => img.slot === slot);
  };

  const handleDragOver = (e: React.DragEvent, slot: ImageSlot) => {
    e.preventDefault();
    setDraggedOverSlot(slot);
  };

  const handleDragLeave = () => {
    setDraggedOverSlot(null);
  };

  const handleDrop = (e: React.DragEvent, slot: ImageSlot) => {
    e.preventDefault();
    setDraggedOverSlot(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadImage(e.dataTransfer.files[0], slot);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, slot: ImageSlot) => {
    if (e.target.files && e.target.files[0]) {
      onUploadImage(e.target.files[0], slot);
    }
    e.target.value = '';
  };

  // Determine dynamic example queries based on current modalities
  const dynamicQuerySuggestions = React.useMemo(() => {
    const hasOptical = images.some(i => i.slot === 'optical' || (!i.slot && images.indexOf(i) === 0));
    const hasSar = images.some(i => i.slot === 'sar');
    const hasBefore = images.some(i => i.slot === 'before');
    const hasAfter = images.some(i => i.slot === 'after');

    if (hasBefore && hasAfter) {
      return [
        "Did built-up area increase between these observations?",
        "Identify candidate physical change regions and ground them",
        "Distinguish real ground change from illumination/seasonal artifacts",
        "Which specific zones exhibit land cover transition?"
      ];
    }

    if (hasOptical && hasSar) {
      return [
        "Compare optical observation with SAR radar backscatter",
        "Verify if visual features correspond to permanent physical structures",
        "Check for cross-modal agreement or sensor conflict",
        "Identify ground features obscured in optical but visible in SAR"
      ];
    }

    if (hasSar) {
      return [
        "Evaluate radar backscatter intensity and structural permanence",
        "Assess smooth specular surfaces vs rough double-bounce returns",
        "Identify potential metallic or vertical built structures",
        "Describe radar texture and backscatter characteristics"
      ];
    }

    if (hasOptical) {
      return [
        "Identify maritime infrastructure, docks, and coastal boundary in this optical scene",
        "Ground and locate the container terminal facilities and vessels",
        "Describe dominant land cover classes in this optical observation",
        "What are the primary ground features and vegetation distribution?"
      ];
    }

    return [
      "Select an SIH benchmark dataset above or upload an image to begin",
      "Did built-up area increase between observations?",
      "Compare optical and SAR radar observations",
      "Locate and ground primary infrastructure"
    ];
  }, [images]);

  // Slot Configuration
  const slots: { slot: ImageSlot; title: string; subtitle: string; icon: React.ReactNode; color: string }[] = [
    {
      slot: 'optical',
      title: 'OPTICAL / MULTISPECTRAL',
      subtitle: 'Visible RGB, False-Color, Sentinel-2 / L2A',
      icon: <Satellite size={16} />,
      color: 'border-indigo-500/40 text-indigo-400'
    },
    {
      slot: 'sar',
      title: 'SAR (SYNTHETIC APERTURE RADAR)',
      subtitle: 'Sentinel-1 C-Band, Radar Backscatter, VV/VH',
      icon: <Radio size={16} />,
      color: 'border-amber-500/40 text-amber-400'
    },
    {
      slot: 'before',
      title: 'BEFORE (TIME 1)',
      subtitle: 'Initial baseline temporal observation',
      icon: <Calendar size={16} />,
      color: 'border-emerald-500/40 text-emerald-400'
    },
    {
      slot: 'after',
      title: 'AFTER (TIME 2)',
      subtitle: 'Subsequent temporal observation for change detection',
      icon: <ArrowRightLeft size={16} />,
      color: 'border-rose-500/40 text-rose-400'
    }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      
      {/* Panel Header */}
      <div className="bg-slate-900/90 border-b border-slate-800 p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Layers size={16} />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Mission Inputs &amp; Modalities</h2>
            <p className="text-[10px] text-slate-400">SIH-26167 Remote Sensing Pipelines</p>
          </div>
        </div>

        {/* Tab switch: Slots vs Benchmark Presets */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
              activeTab === 'slots' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Slots ({images.length})
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors flex items-center gap-1 ${
              activeTab === 'presets' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={11} className="text-amber-400" /> Demo Presets
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        
        {/* VIEW 1: Dedicated Input Slots */}
        {activeTab === 'slots' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Populate slots for multimodal analysis:</span>
              {images.length > 0 && (
                <button 
                  onClick={onClearAll} 
                  className="text-red-400 hover:text-red-300 font-medium text-[10px] underline"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {slots.map(({ slot, title, subtitle, icon, color }) => {
                const img = getImageForSlot(slot);
                const isOver = draggedOverSlot === slot;

                return (
                  <div 
                    key={slot}
                    onDragOver={(e) => handleDragOver(e, slot)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, slot)}
                    className={`border rounded-lg p-2.5 transition-all ${
                      img 
                        ? 'bg-slate-950/80 border-slate-700' 
                        : isOver 
                          ? 'bg-indigo-950/30 border-indigo-400 border-dashed scale-[1.01]' 
                          : 'bg-slate-950/40 border-slate-800/80 border-dashed hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={color}>{icon}</span>
                        <span className="text-[11px] font-bold text-slate-200 tracking-wide">{title}</span>
                      </div>
                      {img ? (
                        <button
                          onClick={() => onRemoveImage(img.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-0.5"
                          title="Remove image"
                        >
                          <X size={14} />
                        </button>
                      ) : (
                        <span className="text-[9px] font-mono text-slate-500">EMPTY</span>
                      )}
                    </div>

                    {img ? (
                      /* Slot Populated with Image & Metadata */
                      <div className="flex gap-2.5 items-center bg-slate-900/60 p-2 rounded border border-slate-800">
                        <div 
                          onClick={() => onSelectImage(images.indexOf(img))}
                          className="relative w-16 h-16 rounded overflow-hidden border border-slate-700 bg-black cursor-pointer group shrink-0"
                          title="Click to view in canvas"
                        >
                          <img 
                            src={img.previewUrl} 
                            alt={title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          />
                          <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[8px] bg-slate-950/90 text-white px-1 py-0.5 rounded font-mono">VIEW</span>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 text-[10px] space-y-0.5">
                          <div className="font-mono text-slate-200 font-semibold truncate">
                            {img.metadata?.fileName || img.file.name}
                          </div>
                          
                          <div className="text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5 font-mono">
                            {img.metadata?.width && img.metadata?.height ? (
                              <span>{img.metadata.width}×{img.metadata.height} px</span>
                            ) : (
                              <span>Dim: Verified</span>
                            )}
                            <span>{img.metadata?.fileSizeFormatted || `${(img.file.size / 1024).toFixed(0)} KB`}</span>
                            {img.metadata?.bandCount && (
                              <span className="text-cyan-400 font-semibold">{img.metadata.bandCount} Band(s)</span>
                            )}
                          </div>

                          <div className="text-[9px] font-mono truncate">
                            {img.metadata?.epsg ? (
                              <span className="text-emerald-400">CRS: EPSG:{img.metadata.epsg}</span>
                            ) : img.metadata?.crs ? (
                              <span className="text-emerald-400">CRS: {img.metadata.crs}</span>
                            ) : (
                              <span className="text-slate-500">Metadata: Standard Pixel Space</span>
                            )}
                            {img.metadata?.polarization && (
                              <span className="text-amber-400 ml-2">Pol: {img.metadata.polarization}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Empty Slot Dropzone & File Picker */
                      <label className="flex flex-col items-center justify-center py-3 px-2 rounded cursor-pointer hover:bg-slate-900/40 transition-colors group">
                        <Upload size={16} className="text-slate-500 group-hover:text-indigo-400 mb-1 transition-colors" />
                        <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-200">
                          + Add {title.split(' ')[0]} Image
                        </span>
                        <span className="text-[9px] text-slate-600 mt-0.5">{subtitle}</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/tiff, .tif, .tiff"
                          onChange={(e) => handleFileInputChange(e, slot)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* VIEW 2: SIH 26167 Benchmark Presets */
          <div className="space-y-3">
            <div className="text-[11px] text-slate-400">
              Load pre-configured synthetic illustration scenarios for interactive demo evaluation:
            </div>

            <div className="space-y-2.5">
              {SAMPLE_DATASETS.map((dataset) => (
                <div 
                  key={dataset.id}
                  onClick={() => {
                    onLoadDataset(dataset);
                    setActiveTab('slots');
                  }}
                  className="bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 p-3 rounded-lg cursor-pointer transition-all hover:bg-slate-900/60 group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      {dataset.badge}
                    </span>
                    <span className="text-[10px] text-indigo-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      Load Dataset →
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                    {dataset.title}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    {dataset.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Mode Selector */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Analysis Pipeline</span>
            <span className="text-[10px] text-indigo-400 font-mono">Agent Router</span>
          </div>

          <select
            value={analysisMode}
            onChange={(e) => onChangeAnalysisMode(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
          >
            <option value="auto">Auto-Select Pipeline (Based on Inputs)</option>
            <option value="single">Single-Image Optical VQA / Captioning</option>
            <option value="optical-sar">Cross-Modal (Optical + SAR Complementary)</option>
            <option value="bi-temporal">Bi-Temporal (Before vs After Change Detection)</option>
          </select>
        </div>

        {/* Dynamic Query Suggestions */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={11} className="text-amber-400" /> Recommended Questions
          </span>
          <div className="flex flex-col gap-1.5">
            {dynamicQuerySuggestions.map((queryText, idx) => (
              <button
                key={idx}
                onClick={() => onChangeQuery(queryText)}
                className="text-left text-[11px] p-2 rounded-lg bg-slate-950/60 hover:bg-indigo-950/40 border border-slate-800/80 hover:border-indigo-600/40 text-slate-300 hover:text-indigo-200 transition-colors leading-snug font-normal"
              >
                "{queryText}"
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Query Execution Form at Bottom of Left Panel */}
      <div className="p-3 bg-slate-950 border-t border-slate-800">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitQuery();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder={images.length > 0 ? "Ask a natural-language query..." : "Upload images or select a preset above..."}
            disabled={isLoading}
            className="w-full pl-3 pr-11 py-2.5 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-200 placeholder-slate-500 focus:bg-slate-850 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || (!inputQuery.trim() && images.length === 0)}
            className="absolute right-1.5 p-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors flex items-center justify-center shadow-md shadow-indigo-600/30"
            title="Execute Remote-Sensing Analysis"
          >
            <Send size={14} />
          </button>
        </form>
      </div>

    </div>
  );
}
