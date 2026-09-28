import React, { useState } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  Layers, 
  Compass, 
  Radio, 
  Eye, 
  Columns, 
  Maximize2, 
  Sparkles, 
  FileCode, 
  Tag, 
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { UploadedImage } from '../types';
import { DEMO_PRESETS, DemoPreset } from '../services/samplePresets';

interface SensorImageryBayProps {
  images: UploadedImage[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (id: string) => void;
  onLoadPreset: (preset: DemoPreset) => void;
  isLoadingPreset: boolean;
  viewportMode: 'single' | 'split';
  setViewportMode: (mode: 'single' | 'split') => void;
  activeImageIndex: number;
  setActiveImageIndex: (idx: number) => void;
  showGroundingBoxes: boolean;
  setShowGroundingBoxes: (show: boolean) => void;
  groundingBoxesCount: number;
}

export const SensorImageryBay: React.FC<SensorImageryBayProps> = ({
  images,
  onFileUpload,
  onRemoveImage,
  onLoadPreset,
  isLoadingPreset,
  viewportMode,
  setViewportMode,
  activeImageIndex,
  setActiveImageIndex,
  showGroundingBoxes,
  setShowGroundingBoxes,
  groundingBoxesCount
}) => {
  const [expandedMetaIndex, setExpandedMetaIndex] = useState<number | null>(null);

  const toggleMeta = (idx: number) => {
    setExpandedMetaIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <aside className="w-full lg:w-[380px] xl:w-[410px] bg-slate-950 border-r border-slate-800/80 flex flex-col shrink-0 h-full overflow-hidden select-none">
      {/* Panel Top Title */}
      <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Sensor Imagery & Rasters
          </h2>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
          {images.length}/2 SLOTS
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Quick Demo Pre-flight Missions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={12} className="text-amber-400" />
              Synthetic Demo Illustrations
            </span>
            <span className="text-[9px] text-slate-500 font-mono">1-CLICK LOAD</span>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {DEMO_PRESETS.map((preset) => {
              const isCrossModal = preset.mode === 'optical-sar';
              const isBitemporal = preset.mode === 'bi-temporal';
              const isSar = preset.id.includes('sar');
              const isIntegrity = preset.id.includes('integrity');

              const badgeColor = isIntegrity 
                ? 'bg-rose-950/80 text-rose-300 border-rose-500/40' 
                : isCrossModal 
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                : isBitemporal 
                ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                : isSar 
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';

              const iconBoxColor = isIntegrity
                ? 'bg-rose-950/70 border-rose-600/40 text-rose-400 group-hover:bg-rose-900/60'
                : isCrossModal
                ? 'bg-amber-950/70 border-amber-600/40 text-amber-400 group-hover:bg-amber-900/60'
                : isBitemporal
                ? 'bg-purple-950/70 border-purple-600/40 text-purple-400 group-hover:bg-purple-900/60'
                : isSar
                ? 'bg-cyan-950/70 border-cyan-600/40 text-cyan-400 group-hover:bg-cyan-900/60'
                : 'bg-emerald-950/70 border-emerald-600/40 text-emerald-400 group-hover:bg-emerald-900/60';

              const cardHoverBorder = isIntegrity
                ? 'hover:border-rose-500/60 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                : isCrossModal
                ? 'hover:border-amber-500/60 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : isBitemporal
                ? 'hover:border-purple-500/60 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                : isSar
                ? 'hover:border-cyan-500/60 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'hover:border-emerald-500/60 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]';

              return (
                <button
                  key={preset.id}
                  onClick={() => onLoadPreset(preset)}
                  disabled={isLoadingPreset}
                  className={`w-full text-left p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 transition-all group flex items-start gap-2.5 disabled:opacity-50 ${cardHoverBorder}`}
                >
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${iconBoxColor}`}>
                    {isCrossModal ? (
                      <Radio size={14} className="text-amber-400" />
                    ) : isBitemporal ? (
                      <Columns size={14} className="text-purple-400" />
                    ) : isSar ? (
                      <Radio size={14} className="text-cyan-400" />
                    ) : isIntegrity ? (
                      <Sparkles size={14} className="text-rose-400" />
                    ) : (
                      <ImageIcon size={14} className="text-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                        {preset.title}
                      </span>
                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeColor}`}>
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5 leading-tight">
                      {preset.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Viewport Control Bar */}
        {images.length > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Display:
              </span>
              <button
                onClick={() => setViewportMode('single')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  viewportMode === 'single'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Single
              </button>
              {images.length === 2 && (
                <button
                  onClick={() => setViewportMode('split')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    viewportMode === 'split'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Split Compare
                </button>
              )}
            </div>

            {groundingBoxesCount > 0 && (
              <label className="flex items-center gap-1.5 text-[10px] text-slate-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGroundingBoxes}
                  onChange={(e) => setShowGroundingBoxes(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span>Boxes ({groundingBoxesCount})</span>
              </label>
            )}
          </div>
        )}

        {/* Uploaded Images List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={12} className="text-cyan-400" />
              Active Rasters ({images.length})
            </span>
          </div>

          {images.map((img, idx) => {
            const isTiff = img.mimeType.includes('tiff') || img.file.name.endsWith('.tif') || img.file.name.endsWith('.tiff');
            const isSar = img.file.name.toLowerCase().includes('sar') || (img.metadata?.polarization && img.metadata.polarization !== 'UNKNOWN');
            const isSelected = activeImageIndex === idx;

            return (
              <div
                key={img.id}
                className={`rounded-xl border transition-all overflow-hidden bg-slate-900/90 shadow-md ${
                  isSelected 
                    ? 'border-cyan-500/80 ring-1 ring-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.25)]' 
                    : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Image Header & Action Bar */}
                <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-mono font-bold text-[10px] flex items-center justify-center shadow">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 truncate max-w-[160px]" title={img.file.name}>
                      {img.file.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Modality Tag */}
                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isSar
                          ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                          : 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                      }`}
                    >
                      {isSar ? 'SAR C-BAND' : 'OPTICAL MSI'}
                    </span>

                    {/* Delete button */}
                    <button
                      onClick={() => onRemoveImage(img.id)}
                      className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Thumbnail Preview Viewport */}
                <div 
                  onClick={() => setActiveImageIndex(idx)}
                  className="relative aspect-video bg-slate-950 cursor-pointer overflow-hidden flex items-center justify-center group"
                >
                  {isTiff ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                      <FileCode size={32} className="mb-2 text-indigo-400" />
                      <span className="text-xs font-mono font-bold text-slate-300">GeoTIFF Data Matrix</span>
                      <span className="text-[10px] text-slate-500 mt-1">Multi-band raster decoded on server</span>
                    </div>
                  ) : (
                    <img
                      src={img.previewUrl}
                      alt={img.file.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  <div className="absolute bottom-1.5 left-1.5 bg-slate-950/85 backdrop-blur-sm text-[9px] font-mono text-slate-300 px-1.5 py-0.5 rounded border border-slate-800">
                    {(img.file.size / 1024 / 1024).toFixed(2)} MB
                  </div>

                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                    Click to Focus
                  </div>
                </div>

                {/* Metadata Accordion Toggle */}
                <button
                  onClick={() => toggleMeta(idx)}
                  className="w-full px-3 py-1.5 bg-slate-950/60 hover:bg-slate-900 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-semibold transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Compass size={12} className="text-indigo-400" />
                    Geospatial & Sensor Metadata
                  </span>
                  {expandedMetaIndex === idx ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {/* Metadata Details */}
                {expandedMetaIndex === idx && (
                  <div className="p-3 bg-slate-950 border-t border-slate-800 text-[10px] font-mono text-slate-300 space-y-1.5">
                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span className="text-slate-500">MIME Type:</span>
                      <span className="text-slate-300">{img.mimeType}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span className="text-slate-500">Modality:</span>
                      <span className="text-cyan-400 font-bold">{isSar ? 'SAR' : 'OPTICAL'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span className="text-slate-500">CRS / Projection:</span>
                      <span className="text-emerald-400 font-semibold">EPSG:32643 (UTM 43N)</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1">
                      <span className="text-slate-500">Pixel Resolution:</span>
                      <span className="text-slate-300">10.0 m / px</span>
                    </div>
                    {isSar && (
                      <div className="flex justify-between border-b border-slate-900 pb-1">
                        <span className="text-slate-500">Polarization:</span>
                        <span className="text-amber-400 font-bold">VV / VH Co-pol</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Coordinate Bounds:</span>
                      <span className="text-slate-400 text-[9px]">[72.82, 18.91, 72.87, 18.96]</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Upload Dropzone if less than 2 images */}
          {images.length < 2 && (
            <label className="border-2 border-dashed border-slate-800 hover:border-cyan-500/70 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all group">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 group-hover:scale-110 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all mb-2 shadow-inner">
                <Upload size={18} />
              </div>
              <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                Ingest Satellite Image {images.length + 1}
              </span>
              <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] leading-tight font-sans">
                Supports GeoTIFF/TIFF, PNG, JPEG. Max 50MB per raster.
              </p>
              <input
                type="file"
                accept="image/jpeg, image/png, image/tiff, .tif, .tiff"
                multiple
                onChange={onFileUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>
    </aside>
  );
};
