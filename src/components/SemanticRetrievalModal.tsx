import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  Layers, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  ArrowRight, 
  Filter, 
  Download, 
  ShieldCheck, 
  Sparkles,
  ExternalLink,
  Satellite
} from 'lucide-react';
import { SampleDataset, SAMPLE_DATASETS } from '../data/sampleDatasets';

export interface SemanticResultItem {
  item: {
    source: string;
    productId: string;
    title: string;
    satellite: string;
    sensor: string;
    acquisitionTime: string;
    bbox: [number, number, number, number];
    resolution: string;
    productType: string;
    access: 'open' | 'restricted' | 'priced';
    downloadAvailable: boolean;
    cloudCoverPercentage?: number;
    orbitDirection?: string;
    polarization?: string;
    sampleType: string;
    sampleDatasetId?: string;
    isTemporalPair?: boolean;
    temporalPairDetails?: {
      epoch1Date: string;
      epoch2Date: string;
      targetPhenomenon: string;
    };
    semanticDescription: string;
    semanticTags: string[];
    metadata?: Record<string, any>;
  };
  similarityScore: number;
  matchHighlights: string[];
  matchedModality: string;
  recommendedQueries: string[];
}

interface SemanticRetrievalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDatasetById: (datasetId: string, initialQuery?: string) => void;
  onSelectBiTemporalMode: () => void;
}

export function SemanticRetrievalModal({
  isOpen,
  onClose,
  onLoadDatasetById,
  onSelectBiTemporalMode
}: SemanticRetrievalModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [modalityFilter, setModalityFilter] = useState<'ALL' | 'OPTICAL' | 'SAR' | 'MULTISPECTRAL' | 'METEOROLOGICAL'>('ALL');
  const [temporalOnly, setTemporalOnly] = useState(false);
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SemanticResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Suggested quick semantic queries
  const presetQueries = [
    { label: 'Urban Expansion Pair', query: 'Peri-urban development and built-up land expansion over time' },
    { label: 'Seaport & Logistics', query: 'Coastal deep-water port, shipping vessels, and breakwater infrastructure' },
    { label: 'SAR Radar Backscatter', query: 'C-Band SAR radar backscatter, speckle ENL, and microwave surface return' },
    { label: 'Cloud Penetration', query: 'Cross-modal optical and radar pair penetrating monsoon clouds' },
    { label: 'Agri NDVI Delta', query: 'Agricultural vegetation index and near-infrared reflectance over river delta' }
  ];

  const handleExecuteSearch = async (queryText: string) => {
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch('/api/eo/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          filters: {
            modality: modalityFilter,
            temporalOnly,
            openAccessOnly
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Search failed with status ${res.status}`);
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (err: any) {
      console.error('Semantic search failed:', err);
      setError(err.message || 'Unable to query semantic catalog.');
    } finally {
      setIsSearching(false);
    }
  };

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen) {
      handleExecuteSearch(searchQuery);
    }
  }, [isOpen, modalityFilter, temporalOnly, openAccessOnly]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Search size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  SEMANTIC SATELLITE RETRIEVAL
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  SIH-26227
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Natural-language discovery & multi-temporal catalog search (ISRO Bhoonidhi • MOSDAC • Copernicus)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar & Query Chips */}
        <div className="p-4 border-b border-slate-800 bg-slate-900 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleExecuteSearch(searchQuery);
                }
              }}
              placeholder="Search satellite archives (e.g., 'urban expansion between 2020 and 2024', 'deep water port shipping berths', 'SAR radar flood')..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-24 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => handleExecuteSearch(searchQuery)}
              disabled={isSearching}
              className="absolute right-2 top-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Preset Prompts */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 font-mono">Suggested:</span>
            {presetQueries.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSearchQuery(preset.query);
                  handleExecuteSearch(preset.query);
                }}
                className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Faceted Filters */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-800/60 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <Filter size={11} /> Modality:
              </span>
              {(['ALL', 'OPTICAL', 'SAR', 'MULTISPECTRAL'] as const).map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => setModalityFilter(mod)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    modalityFilter === mod
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={temporalOnly}
                  onChange={(e) => setTemporalOnly(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                />
                <span className="flex items-center gap-1 text-cyan-400">
                  <Clock size={12} /> Bi-Temporal Pairs Only
                </span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={openAccessOnly}
                  onChange={(e) => setOpenAccessOnly(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                />
                <span className="text-emerald-400">Open Access (ISP-2023)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
              {error}
            </div>
          )}

          {isSearching ? (
            <div className="h-48 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Computing semantic relevance across Earth-Observation catalog...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center space-y-2 text-slate-500 text-center">
              <Layers size={32} className="opacity-40" />
              <p className="text-xs">No matching satellite observations found for this filter criteria.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setModalityFilter('ALL');
                  setTemporalOnly(false);
                  handleExecuteSearch('');
                }}
                className="text-xs text-blue-400 hover:underline cursor-pointer"
              >
                Reset filters & show full catalog
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {results.map(({ item, similarityScore, matchHighlights, matchedModality, recommendedQueries }, idx) => {
                const isPair = item.isTemporalPair;
                return (
                  <div
                    key={item.productId || idx}
                    className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 flex flex-col justify-between transition-all"
                  >
                    <div>
                      {/* Top Bar: Similarity Score & Badges */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                            similarityScore >= 85
                              ? 'bg-emerald-950 border border-emerald-800/60 text-emerald-300'
                              : 'bg-blue-950 border border-blue-800/60 text-blue-300'
                          }`}>
                            {similarityScore}% Semantic Match
                          </span>
                          {isPair && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800/60 text-indigo-300 flex items-center gap-1">
                              <Clock size={10} /> Bi-Temporal Pair
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          {item.source}
                        </span>
                      </div>

                      {/* Title & Satellite */}
                      <h3 className="text-xs font-bold text-white leading-snug">
                        {item.title}
                      </h3>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-semibold text-slate-300">{item.satellite}</span>
                        <span>•</span>
                        <span>{item.sensor}</span>
                        <span>•</span>
                        <span className="text-slate-400">{item.resolution}</span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                        {item.semanticDescription}
                      </p>

                      {/* Temporal Pair Details if present */}
                      {item.temporalPairDetails && (
                        <div className="mt-2 p-2 bg-slate-900/80 rounded border border-slate-800/70 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-cyan-300 font-mono text-[10px]">
                            <span>T1: {item.temporalPairDetails.epoch1Date}</span>
                            <span>→</span>
                            <span>T2: {item.temporalPairDetails.epoch2Date}</span>
                          </div>
                          <p className="text-slate-400 text-[11px]">
                            Target: {item.temporalPairDetails.targetPhenomenon}
                          </p>
                        </div>
                      )}

                      {/* Semantic Tags */}
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {item.semanticTags.slice(0, 4).map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[9px] font-mono bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                      <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                        ID: {item.productId.slice(0, 16)}...
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.sampleDatasetId ? (
                          <button
                            type="button"
                            onClick={() => {
                              onLoadDatasetById(
                                item.sampleDatasetId!,
                                recommendedQueries[0]
                              );
                              if (isPair) {
                                onSelectBiTemporalMode();
                              }
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <span>Load into Workstation</span>
                            <ArrowRight size={13} />
                          </button>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-mono px-2 py-1 bg-amber-950/40 rounded border border-amber-900/40">
                            Clearance Required
                          </span>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 text-slate-500 text-[11px] flex items-center justify-between font-mono">
          <span>Compliant with Indian Space Policy 2023 &amp; NRSC Bhoonidhi Open Data Protocols</span>
          <span>Showing {results.length} semantic catalog observations</span>
        </div>

      </div>
    </div>
  );
}
