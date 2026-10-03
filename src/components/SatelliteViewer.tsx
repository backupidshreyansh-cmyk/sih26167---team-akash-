import React, { useState, useRef } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  SplitSquareVertical, 
  Upload, 
  X, 
  Compass, 
  Layers, 
  ChevronRight,
  FileImage,
  Search,
  Clock
} from 'lucide-react';
import { UploadedImage } from '../types';
import { SAMPLE_DATASETS, SampleDataset } from '../data/sampleDatasets';

interface GroundingBox {
  label: string;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

interface SatelliteViewerProps {
  images: UploadedImage[];
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
  onUploadFiles: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
  onClearAll: () => void;
  onUpdateRelationship?: (relationship: 'before-after' | 'optical-sar' | 'independent') => void;
  onLoadDataset: (dataset: SampleDataset) => void;
  onOpenSemanticSearch?: () => void;
  onOpenTemporalLab?: () => void;
  groundingBoxes?: GroundingBox[];
  activeTask?: string;
  decision?: string;
}

export function SatelliteViewer({
  images,
  selectedImageIndex,
  onSelectImage,
  onUploadFiles,
  onRemoveImage,
  onClearAll,
  onUpdateRelationship,
  onLoadDataset,
  onOpenSemanticSearch,
  onOpenTemporalLab,
  groundingBoxes = [],
  activeTask
}: SatelliteViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Split comparison view for 2 images
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [splitPos, setSplitPos] = useState(50); // percentage 0-100
  const [isSplitDragging, setIsSplitDragging] = useState(false);
  
  // Layer toggles
  const [showGrounding, setShowGrounding] = useState(true);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // File drag & drop over viewer
  const [isDragOver, setIsDragOver] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentImage = images[selectedImageIndex] || images[0];
  const secondImage = images.length > 1 ? (selectedImageIndex === 0 ? images[1] : images[0]) : null;

  const handleResetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoom = (delta: number) => {
    setScale(prev => {
      const next = Math.max(0.4, Math.min(prev + delta, 5.0));
      return Number(next.toFixed(2));
    });
  };

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isSplitDragging) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }

    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / scale;
      const rawY = (e.clientY - rect.top) / scale;
      if (rawX >= 0 && rawX <= (currentImage?.metadata?.width || rect.width) &&
          rawY >= 0 && rawY <= (currentImage?.metadata?.height || rect.height)) {
        setCursorPos({ x: Math.round(rawX), y: Math.round(rawY) });
      } else {
        setCursorPos(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsSplitDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleContainerDragLeave = () => {
    setIsDragOver(false);
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Detected Modality Label
  const detectedModality = React.useMemo(() => {
    if (images.length === 0) return null;
    if (images.length === 2) {
      const hasSar = images.some(img => img.slot === 'sar' || img.metadata?.modality === 'SAR');
      const hasOptical = images.some(img => img.slot === 'optical' || img.slot === 'primary' || img.metadata?.modality === 'OPTICAL');
      if (hasSar && hasOptical) return 'Optical + SAR candidate pair';
      return 'Before / After candidate pair';
    }
    const single = images[0];
    if (single.slot === 'sar' || single.metadata?.modality === 'SAR') return 'SAR radar observation';
    if (single.metadata?.bandCount && single.metadata.bandCount > 3) return 'Multispectral imagery';
    return 'Optical image';
  }, [images]);

  // Detected relationship for 2 images
  const currentRelationship = React.useMemo<'before-after' | 'optical-sar' | 'independent'>(() => {
    if (images.length !== 2) return 'independent';
    const hasBefore = images.some(i => i.slot === 'before');
    const hasAfter = images.some(i => i.slot === 'after');
    if (hasBefore && hasAfter) return 'before-after';
    const hasSar = images.some(i => i.slot === 'sar' || i.metadata?.modality === 'SAR');
    if (hasSar) return 'optical-sar';
    return 'before-after';
  }, [images]);

  return (
    <div className="h-full flex flex-col bg-slate-950 border border-slate-800/90 rounded-xl overflow-hidden select-none relative">
      
      {/* Hidden Unified File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".tif,.tiff,.png,.jpg,.jpeg,.geotiff,image/tiff,image/png,image/jpeg"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* TOP CONTROL BAR: Upload & Classification & Tools */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
        
        {/* Left Side: Upload Control & Automatic Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Upload one or multiple satellite images"
          >
            <Upload size={13} />
            <span>{images.length > 0 ? '+ Add another observation' : 'Upload imagery'}</span>
          </button>

          {images.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <span>✓ {images.length} {images.length === 1 ? 'image' : 'images'}</span>
              <span>·</span>
              <span className="text-slate-300">
                {currentImage?.metadata?.width || 800}×{currentImage?.metadata?.height || 800}
              </span>
              <span>·</span>
              <span className="text-blue-400 font-medium font-sans">
                {detectedModality}
              </span>
              
              <button
                type="button"
                onClick={onClearAll}
                className="text-[11px] text-slate-500 hover:text-red-400 ml-2 transition-colors cursor-pointer"
                title="Clear loaded imagery"
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400">
              GeoTIFF • TIFF • PNG • JPEG
            </span>
          )}
        </div>

        {/* Center: When 2 images, 1-click relationship clarification */}
        {images.length === 2 && onUpdateRelationship && (
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              Relationship:
            </span>
            <button
              type="button"
              onClick={() => onUpdateRelationship('before-after')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                currentRelationship === 'before-after'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Before / After
            </button>
            <button
              type="button"
              onClick={() => onUpdateRelationship('optical-sar')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                currentRelationship === 'optical-sar'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Optical + SAR
            </button>
            <button
              type="button"
              onClick={() => onUpdateRelationship('independent')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                currentRelationship === 'independent'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Two observations
            </button>
          </div>
        )}

        {/* Right Side: Viewer Tools */}
        {images.length > 0 && (
          <div className="flex items-center gap-1.5">
            {images.length === 2 && onOpenTemporalLab && (
              <button
                type="button"
                onClick={onOpenTemporalLab}
                className="px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 shadow-xs"
                title="Launch Deep Multi-Temporal Change Lab"
              >
                <Clock size={13} />
                <span>Change Lab</span>
              </button>
            )}

            {images.length > 1 && (
              <button
                type="button"
                onClick={() => setIsCompareMode(!isCompareMode)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  isCompareMode
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Toggle Split Comparison Mode"
              >
                <SplitSquareVertical size={13} />
                <span>Split View</span>
              </button>
            )}

            <div className="flex items-center bg-slate-800 rounded p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => handleZoom(-0.25)}
                className="p-1 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="text-[11px] px-1 text-slate-300 font-mono">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => handleZoom(0.25)}
                className="p-1 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetView}
              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors cursor-pointer"
              title="Reset View"
            >
              <RotateCcw size={13} />
            </button>

            {groundingBoxes.length > 0 && (
              <button
                type="button"
                onClick={() => setShowGrounding(!showGrounding)}
                className={`p-1 rounded border text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                  showGrounding 
                    ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title={showGrounding ? "Hide Grounding Boxes" : "Show Grounding Boxes"}
              >
                {showGrounding ? <Eye size={13} /> : <EyeOff size={13} />}
                <span className="text-[11px] font-mono">{groundingBoxes.length}</span>
              </button>
            )}
          </div>
        )}

      </div>

      {/* SUB-VIEWER TAB BAR (for switching between loaded observations when not in split mode) */}
      {images.length > 1 && !isCompareMode && (
        <div className="bg-slate-900/60 border-b border-slate-800/80 px-3 py-1 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">View:</span>
          {images.map((img, idx) => {
            const roleLabel = img.slot === 'before' ? 'Before (T1)' : img.slot === 'after' ? 'After (T2)' : img.slot === 'sar' ? 'SAR Radar' : `Observation ${idx + 1}`;
            const isSelected = selectedImageIndex === idx;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => onSelectImage(idx)}
                className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{roleLabel}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(img.id);
                  }}
                  className="hover:text-red-300 ml-1"
                >
                  <X size={11} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* CANVAS CONTAINER */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragOver={handleContainerDragOver}
        onDragLeave={handleContainerDragLeave}
        onDrop={handleContainerDrop}
        className={`flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing bg-slate-950 ${
          isDragOver ? 'ring-2 ring-blue-500 ring-inset bg-blue-950/20' : ''
        }`}
      >
        
        {/* EMPTY STATE: CLEAN SCIENTIFIC WORKFLOW */}
        {images.length === 0 ? (
          <div className="text-center p-6 max-w-lg mx-auto my-auto z-10 select-none">
            
            {/* Primary Drop Target Box */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500/80 bg-slate-900/50 hover:bg-slate-900/80 rounded-xl p-8 transition-all cursor-pointer space-y-3 mb-6 group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-blue-400 group-hover:scale-105 transition-transform">
                <Upload size={22} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  DROP SATELLITE IMAGERY HERE
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Drop single or multiple files here, or click to browse.
                </p>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Supported: GeoTIFF • TIFF • PNG • JPEG
              </div>
            </div>

            {/* Semantic Satellite Retrieval Banner (SIH-26227) */}
            {onOpenSemanticSearch && (
              <button
                type="button"
                onClick={onOpenSemanticSearch}
                className="w-full py-2.5 px-3.5 mb-5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/60 text-blue-300 hover:text-white flex items-center justify-between transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                    <Search size={15} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Search Earth-Observation Archives (Semantic Retrieval)</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-900 text-blue-200">SIH-26227</span>
                    </div>
                    <div className="text-[11px] text-slate-400">Natural-language discovery across ISRO Bhoonidhi, MOSDAC &amp; Copernicus</div>
                  </div>
                </div>
                <ChevronRight size={15} className="text-blue-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            {/* Clearly Labelled Benchmark Examples */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-500 font-mono block">
                Try an example:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {SAMPLE_DATASETS.map((dataset) => (
                  <button
                    key={dataset.id}
                    type="button"
                    onClick={() => onLoadDataset(dataset)}
                    className="p-2.5 rounded-lg bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all cursor-pointer group space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-slate-400">
                        {dataset.sampleType}
                      </span>
                      <ChevronRight size={11} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors leading-snug">
                      {dataset.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                      {dataset.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

          </div>
        ) : (
          /* CANVAS: RENDERING RASTER & SPLIT VIEW */
          <div
            className="relative transition-transform duration-75 ease-out select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center'
            }}
          >
            {isCompareMode && secondImage ? (
              <div className="relative inline-block overflow-hidden rounded border border-slate-800 shadow-xl">
                <img
                  src={secondImage.previewUrl}
                  alt="Observation B"
                  className="block max-h-[72vh] w-auto max-w-[85vw] object-contain"
                  draggable={false}
                />
                
                {/* Wiped First Image */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${splitPos}%`, borderRight: '2px solid #3b82f6' }}
                >
                  <img
                    src={currentImage.previewUrl}
                    alt="Observation A"
                    className="block max-h-[72vh] w-auto max-w-[85vw] object-contain"
                    style={{
                      maxWidth: 'none',
                      width: imageRef.current ? `${imageRef.current.clientWidth}px` : 'auto',
                      height: imageRef.current ? `${imageRef.current.clientHeight}px` : 'auto'
                    }}
                    draggable={false}
                  />
                </div>

                {/* Draggable Split Divider */}
                <div 
                  className="absolute top-0 bottom-0 w-6 -ml-3 flex items-center justify-center cursor-ew-resize z-20"
                  style={{ left: `${splitPos}%` }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsSplitDragging(true);
                  }}
                >
                  <div className="w-1.5 h-8 bg-blue-500 rounded-full shadow-md" />
                </div>
              </div>
            ) : (
              /* Single View */
              <div className="relative inline-block shadow-xl rounded overflow-hidden">
                <img
                  ref={imageRef}
                  src={currentImage.previewUrl}
                  alt={currentImage.metadata?.fileName || 'Satellite Raster'}
                  className="block max-h-[72vh] w-auto max-w-[85vw] object-contain rounded"
                  draggable={false}
                />

                {/* Grounding Evidence Bounding Boxes */}
                {showGrounding && groundingBoxes.length > 0 && (
                  <svg 
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                  >
                    {groundingBoxes.map((box, idx) => {
                      const width = Math.max(box.xmax - box.xmin, 8);
                      const height = Math.max(box.ymax - box.ymin, 8);
                      return (
                        <g key={idx}>
                          <rect
                            x={box.xmin}
                            y={box.ymin}
                            width={width}
                            height={height}
                            fill="rgba(16, 185, 129, 0.12)"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            rx="3"
                          />
                          <foreignObject
                            x={box.xmin}
                            y={Math.max(box.ymin - 22, 2)}
                            width="260"
                            height="22"
                          >
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 shadow-sm truncate">
                              <span>{box.label || `Target ${idx + 1}`}</span>
                            </div>
                          </foreignObject>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cursor Coordinates Readout */}
        {cursorPos && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-400 pointer-events-none">
            X: {cursorPos.x}px · Y: {cursorPos.y}px
          </div>
        )}

      </div>

    </div>
  );
}
