import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  Filter,
  Search,
  Clock,
  Layers,
  MapPin,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Archive
} from 'lucide-react';

export type ReviewStatus = 'NEW' | 'IN_REVIEW' | 'CONFIRMED' | 'REJECTED' | 'UNCERTAIN' | 'ARCHIVED';

export interface AnalystReviewWorkspaceProps {
  onOpenTemporalLab?: (beforeImgUrl?: string, afterImgUrl?: string) => void;
  onOpenDiscovery?: (sceneId: string) => void;
}

export function AnalystReviewWorkspace({
  onOpenTemporalLab,
  onOpenDiscovery
}: AnalystReviewWorkspaceProps) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Decision Modal States
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string>('SEASONAL_VARIATION');
  const [rejectionNotes, setRejectionNotes] = useState('');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmedEvidence, setConfirmedEvidence] = useState<string[]>([
    'PERSISTENT_CHANGE',
    'STRONG_SPATIAL_COHERENCE',
    'REGISTRATION_USABLE'
  ]);
  const [analystNotes, setAnalystNotes] = useState('');

  // Audit Trail Drawer
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);

  // Feedback Notification
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (changeTypeFilter !== 'ALL') params.set('changeType', changeTypeFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/review/queue?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        if (data.candidates?.length > 0 && !selectedCandidate) {
          setSelectedCandidate(data.candidates[0]);
        } else if (selectedCandidate) {
          const updated = data.candidates.find((c: any) => c.candidateId === selectedCandidate.candidateId);
          if (updated) setSelectedCandidate(updated);
        }
      }
    } catch (err) {
      console.warn('Failed to load review queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditTrail = async () => {
    try {
      const res = await fetch('/api/review/audit-trail?limit=40');
      if (res.ok) {
        const data = await res.json();
        setAuditEvents(data.events || []);
      }
    } catch (err) {
      console.warn('Failed to fetch audit trail:', err);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [statusFilter, changeTypeFilter]);

  const handleDecision = async (
    decision: 'CONFIRMED' | 'REJECTED' | 'UNCERTAIN',
    customPayload: any = {}
  ) => {
    if (!selectedCandidate) return;

    try {
      const payload = {
        decision,
        ...customPayload
      };

      const res = await fetch(`/api/review/candidates/${selectedCandidate.candidateId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedCandidate(updated);
        setActionNotice(`Candidate marked ${decision} with persistent audit logging.`);
        setTimeout(() => setActionNotice(null), 4000);
        await fetchQueue();
        setIsRejectModalOpen(false);
        setIsConfirmModalOpen(false);
      }
    } catch (err) {
      console.error('Decision submission error:', err);
    }
  };

  const handleBulkDecision = async (decision: 'CONFIRMED' | 'REJECTED') => {
    if (selectedIds.size === 0) return;

    try {
      const res = await fetch('/api/review/candidates/bulk-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateIds: Array.from(selectedIds),
          decision,
          confirmedEvidence: decision === 'CONFIRMED' ? ['PERSISTENT_CHANGE', 'REGISTRATION_USABLE'] : undefined,
          rejectionReason: decision === 'REJECTED' ? 'FALSE_ALARM' : undefined
        })
      });

      if (res.ok) {
        setActionNotice(`Bulk action: ${selectedIds.size} candidates marked ${decision}.`);
        setTimeout(() => setActionNotice(null), 4000);
        setSelectedIds(new Set());
        await fetchQueue();
      }
    } catch (err) {
      console.error('Bulk decision error:', err);
    }
  };

  const toggleSelectId = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const evidenceOptions = [
    { id: 'PERSISTENT_CHANGE', label: 'Persistent physical change across subsequent observations' },
    { id: 'STRONG_SPATIAL_COHERENCE', label: 'Strong spatial coherence & structural boundary compactness' },
    { id: 'REGISTRATION_USABLE', label: 'Sub-pixel spatial co-registration verified (error < 0.5 px)' },
    { id: 'COMPATIBLE_OBSERVATIONS', label: 'Radiometric & viewing geometry compatibility verified' },
    { id: 'SEMANTIC_INTERPRETATION_SUPPORTED', label: 'Surface transformation corresponds to verified phenomenon' }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* Workspace Sub-Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">
                ANALYST REVIEW &amp; PROVENANCE WORKSPACE
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                ISRO SIH-26227 §2.2.5
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Evidence validation • False-alarm decision audit • Feedback-aware ranking refinement
            </p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2">
          {actionNotice && (
            <div className="px-3 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-lg animate-in fade-in flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={13} />
              <span>{actionNotice}</span>
            </div>
          )}

          <a
            href="/api/review/export/csv"
            download
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </a>

          <a
            href="/api/review/export/json"
            download
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText size={13} />
            <span>Export JSON</span>
          </a>

          <button
            type="button"
            onClick={() => {
              fetchAuditTrail();
              setShowAuditTrail(!showAuditTrail);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showAuditTrail
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
            }`}
          >
            <Clock size={13} />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Main Workspace 2-Column Split: Queue on Left, Review Card on Right */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Panel: Review Queue List */}
        <div className="w-80 md:w-96 border-r border-slate-800 bg-slate-900/40 flex flex-col overflow-hidden">
          
          {/* Queue Filters & Search */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-900/60 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidates or locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchQueue(); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 text-[11px] text-slate-300 rounded-md px-2 py-1 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="NEW">New (Unreviewed)</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="REJECTED">Rejected</option>
                <option value="UNCERTAIN">Uncertain</option>
              </select>

              <select
                value={changeTypeFilter}
                onChange={(e) => setChangeTypeFilter(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 text-[11px] text-slate-300 rounded-md px-2 py-1 outline-none"
              >
                <option value="ALL">All Phenomenon</option>
                <option value="CONSTRUCTION">Construction</option>
                <option value="WATER_EXTENT_CHANGE">Water Extent</option>
                <option value="CLEARANCE">Clearance</option>
                <option value="ROAD_DEVELOPMENT">Road Network</option>
                <option value="VEGETATION_CHANGE">Vegetation</option>
              </select>

              <button
                type="button"
                onClick={fetchQueue}
                title="Refresh Queue"
                className="p-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
              >
                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Bulk Action Controls */}
            {selectedIds.size > 0 && (
              <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-xs animate-in fade-in">
                <span className="text-[11px] text-slate-400 font-mono">
                  {selectedIds.size} selected
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleBulkDecision('CONFIRMED')}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium"
                  >
                    Confirm Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkDecision('REJECTED')}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-medium"
                  >
                    Reject Selected
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Candidate List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
            {candidates.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <Layers size={24} className="mx-auto opacity-40" />
                <p className="text-xs">No review candidates match current filter.</p>
              </div>
            ) : (
              candidates.map((cand) => {
                const isSelected = selectedCandidate?.candidateId === cand.candidateId;
                const isChecked = selectedIds.has(cand.candidateId);

                return (
                  <div
                    key={cand.candidateId}
                    onClick={() => setSelectedCandidate(cand)}
                    className={`p-3 transition-colors cursor-pointer flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-blue-950/40 border-l-2 border-l-blue-500'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectId(cand.candidateId);
                      }}
                      className="mt-1 rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
                    />

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono text-slate-400">
                          {cand.candidateId}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase ${
                            cand.status === 'CONFIRMED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : cand.status === 'REJECTED'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : cand.status === 'UNCERTAIN'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-blue-950 text-blue-300 border border-blue-800'
                          }`}
                        >
                          {cand.status}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-white truncate">
                        {cand.identity.locationName}
                      </h4>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span className="text-cyan-400">
                          {cand.change.changeClassification}
                        </span>
                        <span>•</span>
                        <span>{cand.change.changePercentage.toFixed(1)}% changed</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span>{cand.identity.sensors[0] || 'Sensor'}</span>
                        <span>{cand.temporal.earliestSupportedDateOrRange || '1 Epoch'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Queue Footer */}
          <div className="p-2 border-t border-slate-800/80 bg-slate-950 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Total: {candidates.length} candidates</span>
            <span>Local Archive Storage</span>
          </div>
        </div>

        {/* Right Panel: Selected Candidate Review Card */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-4 lg:p-6 space-y-5">
          {selectedCandidate ? (
            <div className="max-w-4xl mx-auto w-full space-y-5 animate-in fade-in duration-150">
              
              {/* Card Header & Decision Bar */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span>RUN: {selectedCandidate.sourceRunId}</span>
                    <span>•</span>
                    <span className="uppercase text-blue-400">{selectedCandidate.sourceType}</span>
                  </div>
                  <h2 className="text-base font-bold text-white mt-0.5">
                    {selectedCandidate.identity.locationName}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    CRS: {selectedCandidate.identity.crs || 'Unreferenced'}
                  </p>
                </div>

                {/* Primary Decision Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 size={15} />
                    <span>CONFIRM</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(true)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <XCircle size={15} />
                    <span>REJECT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecision('UNCERTAIN', { analystNotes: 'Marked uncertain pending auxiliary sensor corroboration' })}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <HelpCircle size={14} />
                    <span>UNCERTAIN</span>
                  </button>
                </div>
              </div>

              {/* Visual Evidence Showcase: Before / After */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Calendar size={13} className="text-blue-400" />
                      Baseline Epoch (Before)
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {selectedCandidate.temporal.beforeDate?.slice(0, 10) || 'Date unavailable'}
                    </span>
                  </div>

                  <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80 flex items-center justify-center relative group">
                    <img
                      src={selectedCandidate.visualEvidence.beforeImageUrl || '/thumbnails/default_before.png'}
                      alt="Before Observation"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback SVG representation
                        (e.target as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%230f172a"><rect width="300" height="200"/><text x="50%" y="50%" fill="%2364748b" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="12">BASELINE OBSERVATION</text></svg>';
                      }}
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-slate-300">
                      T1 Epoch
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Calendar size={13} className="text-cyan-400" />
                      Transformation Epoch (After)
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {selectedCandidate.temporal.afterDate?.slice(0, 10) || 'Date unavailable'}
                    </span>
                  </div>

                  <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80 flex items-center justify-center relative group">
                    <img
                      src={selectedCandidate.visualEvidence.afterImageUrl || '/thumbnails/default_after.png'}
                      alt="After Observation"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%230f172a"><rect width="300" height="200"/><text x="50%" y="50%" fill="%2306b6d4" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="12">TRANSFORMATION EPOCH</text></svg>';
                      }}
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-cyan-300">
                      T2 Epoch ({selectedCandidate.change.changeClassification})
                    </div>
                  </div>
                </div>
              </div>

              {/* Deep Analysis Details: 3 Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Detected Change Metrics */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200 border-b border-slate-800 pb-2">
                    <Sparkles size={14} className="text-cyan-400" />
                    <span>DETECTED CHANGE</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Phenomenon</span>
                      <span className="font-semibold text-white">{selectedCandidate.change.changeClassification}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Changed Surface Extent</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {selectedCandidate.change.changePercentage.toFixed(2)}%
                      </span>
                      <span className="text-slate-500 text-[10px] block">
                        {selectedCandidate.change.changedPixelCount?.toLocaleString()} of {selectedCandidate.change.totalScenePixels?.toLocaleString()} px
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Earliest Supported Observation</span>
                      <span className="font-mono text-white text-[11px]">
                        {selectedCandidate.temporal.earliestSupportedDateOrRange || 'Single observation'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Detection Algorithm</span>
                      <span className="font-mono text-[10px] text-slate-300">
                        {selectedCandidate.change.changeMethod}
                      </span>
                    </div>
                  </div>

                  {onOpenTemporalLab && (
                    <button
                      type="button"
                      onClick={() => onOpenTemporalLab(selectedCandidate.visualEvidence.beforeImageUrl, selectedCandidate.visualEvidence.afterImageUrl)}
                      className="w-full mt-2 py-1.5 bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Open in Multi-Temporal Lab</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>

                {/* 2. False-Alarm Screening & Quality Gate */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200 border-b border-slate-800 pb-2">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    <span>FALSE-ALARM SCREENING</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Overall Quality</span>
                      <span className="font-mono text-[11px] text-emerald-400 font-bold">
                        {selectedCandidate.quality.overallStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Co-Registration</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {selectedCandidate.quality.registrationStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Seasonal Difference</span>
                      <span className={`font-mono text-[11px] ${selectedCandidate.quality.seasonalDifferenceDetected ? 'text-amber-400' : 'text-slate-400'}`}>
                        {selectedCandidate.quality.seasonalDifferenceDetected ? 'YES (FLAGGED)' : 'NONE'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Spatial Coherence</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {selectedCandidate.quality.spatialCoherenceStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Temporal Persistence</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {selectedCandidate.quality.persistenceStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Radiometric Calibration</span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {selectedCandidate.quality.radiometricStatus}
                      </span>
                    </div>
                  </div>

                  {selectedCandidate.quality.qualityWarnings?.length > 0 && (
                    <div className="p-2 bg-amber-950/40 border border-amber-900/60 rounded text-[10px] text-amber-300 space-y-0.5">
                      {selectedCandidate.quality.qualityWarnings.map((w: string, i: number) => (
                        <div key={i} className="flex items-start gap-1">
                          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Retrieval & Provenance Signals */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200 border-b border-slate-800 pb-2">
                    <Clock size={14} className="text-blue-400" />
                    <span>RETRIEVAL &amp; PROVENANCE</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Original Query</span>
                      <span className="text-slate-200 text-[11px] italic">
                        "{selectedCandidate.retrieval.originalQuery || 'Similar Site Discovery'}"
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Vector Similarity</span>
                      <span className="font-mono text-blue-400 font-bold">
                        {(selectedCandidate.retrieval.similarityScore * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Sensors / Platform</span>
                      <span className="text-slate-300 font-mono text-[11px]">
                        {selectedCandidate.identity.satellites[0]} ({selectedCandidate.identity.sensors[0]})
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Model &amp; Weights</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {selectedCandidate.provenance.modelVersion} ({selectedCandidate.provenance.embeddingVersion})
                      </span>
                    </div>
                  </div>

                  {onOpenDiscovery && selectedCandidate.identity.sceneId && (
                    <button
                      type="button"
                      onClick={() => onOpenDiscovery(selectedCandidate.identity.sceneId)}
                      className="w-full mt-2 py-1.5 bg-blue-950/70 hover:bg-blue-900/80 text-blue-300 border border-blue-800 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles size={13} />
                      <span>Find Similar Locations</span>
                    </button>
                  )}
                </div>

              </div>

              {/* Processing History Audit Trail for Candidate */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText size={14} className="text-emerald-400" />
                    FACTUAL PROCESSING PROVENANCE (STRICT VERIFICATION)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Enqueued: {new Date(selectedCandidate.enqueuedAt).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {selectedCandidate.processingHistory.map((step: any, sIdx: number) => (
                    <div key={sIdx} className="flex items-start gap-2 text-xs">
                      <div className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 mt-0.5 shrink-0">
                        <CheckCircle2 size={10} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-200">{step.step}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {step.details && (
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {step.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <ShieldCheck size={40} className="opacity-30" />
              <p className="text-sm">Select a candidate from the review queue on the left.</p>
            </div>
          )}
        </div>

      </div>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 size={20} />
              <h3 className="text-sm font-bold text-white">CONFIRM SATELLITE EVIDENCE</h3>
            </div>

            <p className="text-xs text-slate-300">
              Select verified physical evidence observations supporting confirmation of this candidate:
            </p>

            <div className="space-y-2">
              {evidenceOptions.map((opt) => {
                const isChecked = confirmedEvidence.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className="flex items-start gap-2 text-xs text-slate-300 p-2 bg-slate-950 rounded-lg border border-slate-800/80 cursor-pointer hover:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (isChecked) {
                          setConfirmedEvidence(confirmedEvidence.filter(e => e !== opt.id));
                        } else {
                          setConfirmedEvidence([...confirmedEvidence, opt.id]);
                        }
                      }}
                      className="mt-0.5 rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Optional Analyst Notes</label>
              <textarea
                value={analystNotes}
                onChange={(e) => setAnalystNotes(e.target.value)}
                placeholder="Add contextual observations (e.g., ground transformation verified with optical geometry)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-emerald-500 h-20 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleDecision('CONFIRMED', { confirmedEvidence, analystNotes })}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Confirm &amp; Record Audit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <XCircle size={20} />
              <h3 className="text-sm font-bold text-white">REJECT SATELLITE CANDIDATE</h3>
            </div>

            <p className="text-xs text-slate-300">
              Specify the deterministic reason for rejecting this candidate to refine feedback ranking:
            </p>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1 font-mono">REJECTION REASON</label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-rose-500"
              >
                <option value="SEASONAL_VARIATION">SEASONAL_VARIATION (Vegetation or dry/wet cycle shift)</option>
                <option value="FALSE_ALARM">FALSE_ALARM (Shadow, cloud boundary, or illumination angle)</option>
                <option value="REGISTRATION_ERROR">REGISTRATION_ERROR (Spatial misalignment / geometric artifact)</option>
                <option value="LOW_IMAGE_QUALITY">LOW_IMAGE_QUALITY (Excessive cloud cover or sensor noise)</option>
                <option value="WRONG_SEMANTIC_MATCH">WRONG_SEMANTIC_MATCH (Does not match semantic query)</option>
                <option value="NO_MEANINGFUL_CHANGE">NO_MEANINGFUL_CHANGE (Difference below significance threshold)</option>
                <option value="DUPLICATE_SITE">DUPLICATE_SITE (Redundant observation of existing site)</option>
                <option value="OTHER">OTHER (Specified in analyst notes)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1 font-mono">ANALYST NOTES</label>
              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Reason details for audit trail..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-rose-500 h-20 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleDecision('REJECTED', { rejectionReason, rejectionNotes })}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                <XCircle size={14} />
                <span>Reject &amp; Record Feedback</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Drawer Modal */}
      {showAuditTrail && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col p-4 animate-in slide-in-from-right duration-200 select-none">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-blue-400" />
              <h3 className="text-xs font-bold text-white tracking-tight uppercase">
                CHRONOLOGICAL AUDIT TRAIL
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAuditTrail(false)}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
            {auditEvents.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No audit events logged yet.</p>
            ) : (
              auditEvents.map((evt) => (
                <div key={evt.eventId} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>{evt.eventId}</span>
                    <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <span className="text-blue-400">{evt.operation}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    RUN: {evt.runId}
                  </div>
                  {evt.details && (
                    <div className="text-[10px] text-slate-500 font-mono bg-slate-900/80 p-1.5 rounded truncate">
                      {JSON.stringify(evt.details)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
