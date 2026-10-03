import React, { useState, useEffect } from 'react';
import { OFFICIAL_SYSTEM_SPECIFICATION } from './specification';
import { AgentResponse, Message, UploadedImage, ImageSlot } from './types';
import { checkHealth, sendChatMessage } from './services/chatService';
import { WorkstationHeader } from './components/WorkstationHeader';
import { SatelliteViewer } from './components/SatelliteViewer';
import { UnifiedQuestionResultPanel } from './components/UnifiedQuestionResultPanel';
import { SpecificationModal } from './components/SpecificationModal';
import { SemanticRetrievalModal } from './components/SemanticRetrievalModal';
import { MultiTemporalChangeSuite } from './components/MultiTemporalChangeSuite';
import { AnalystReviewWorkspace } from './components/AnalystReviewWorkspace';
import { SimilarSiteDiscoveryModal } from './components/SimilarSiteDiscoveryModal';
import { EvaluationDiagnosticsModal } from './components/EvaluationDiagnosticsModal';
import { SampleDataset, SAMPLE_DATASETS, loadSampleDataset } from './data/sampleDatasets';
import { generateSihReport } from './utils/reportGenerator';
import { AlertCircle, X, Compass, ShieldCheck } from 'lucide-react';

export default function App() {
  const [trainingData, setTrainingData] = useState(OFFICIAL_SYSTEM_SPECIFICATION);
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [isSemanticModalOpen, setIsSemanticModalOpen] = useState(false);
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [discoveryRefSceneId, setDiscoveryRefSceneId] = useState<string>('amaravati_krishna_river_s2');

  // Active view: 'workstation' (default), 'temporal-lab' (multi-temporal comparison), or 'review' (analyst review queue)
  const [workspaceView, setWorkspaceView] = useState<'workstation' | 'temporal-lab' | 'review'>('workstation');

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [analysisMode, setAnalysisMode] = useState<string>('auto');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Mobile tab state for responsiveness
  const [mobileTab, setMobileTab] = useState<'viewer' | 'results'>('viewer');

  // Session & Run ID
  const [sessionId] = useState<string>(
    () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

  // Messages & Response history
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: 'SatQuery AI Earth Observation Workstation ready.'
    }
  ]);

  // AI Provider State (auto by default, toggleable in settings)
  const [aiMode, setAiMode] = useState<'auto' | 'online' | 'offline'>('auto');
  const [systemHealth, setSystemHealth] = useState<{
    gemini?: { configured: boolean; available: boolean; model: string };
    ollama?: { available: boolean; model: string };
    offlineReady?: boolean;
    onlineReady?: boolean;
  }>({});
  const [healthStatus, setHealthStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  // Health Polling
  useEffect(() => {
    let mounted = true;
    const fetchHealth = async () => {
      try {
        const data = await checkHealth();
        if (!mounted) return;
        setSystemHealth(data);
        if (data.onlineReady || data.offlineReady) {
          setHealthStatus('available');
        } else {
          setHealthStatus('unavailable');
        }
      } catch {
        if (!mounted) return;
        setHealthStatus('unavailable');
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Unified File Upload Handler (accepts 1 or multiple files)
  const handleUploadFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    const readPromises = files.map((file, idx) => {
      return new Promise<UploadedImage>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const commaIdx = base64String.indexOf(',');
          const base64Data = commaIdx !== -1 ? base64String.substring(commaIdx + 1) : base64String;
          const fileNameLower = file.name.toLowerCase();
          const isTiff = file.type.includes('tiff') || fileNameLower.endsWith('.tif') || fileNameLower.endsWith('.tiff');
          const isSar = fileNameLower.includes('sar') || fileNameLower.includes('radar') || fileNameLower.includes('c-band');
          const isBefore = fileNameLower.includes('before') || fileNameLower.includes('t1') || fileNameLower.includes('pre');
          const isAfter = fileNameLower.includes('after') || fileNameLower.includes('t2') || fileNameLower.includes('post');

          let slot: ImageSlot = 'primary';
          let modality: 'OPTICAL' | 'SAR' | 'UNKNOWN' = 'OPTICAL';

          if (isSar) {
            slot = 'sar';
            modality = 'SAR';
          } else if (isBefore) {
            slot = 'before';
          } else if (isAfter) {
            slot = 'after';
          } else if (idx === 0) {
            slot = 'optical';
          } else {
            slot = 'secondary';
          }

          resolve({
            id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`,
            file,
            previewUrl: base64String,
            base64Data,
            mimeType: file.type || (isTiff ? 'image/tiff' : 'image/jpeg'),
            slot,
            metadata: {
              fileName: file.name,
              fileSizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
              sizeBytes: file.size,
              isTiff,
              modality
            }
          });
        };
        reader.readAsDataURL(file);
      });
    });

    const newUploaded = await Promise.all(readPromises);

    setImages((prev) => {
      const combined = [...prev, ...newUploaded];
      
      // Auto-classify multi-image relationship
      if (combined.length === 2) {
        const hasSar = combined.some(i => i.metadata?.modality === 'SAR' || i.slot === 'sar');
        if (hasSar) {
          // Optical + SAR pair
          combined[0].slot = combined[0].metadata?.modality === 'SAR' ? 'sar' : 'optical';
          combined[1].slot = combined[1].metadata?.modality === 'SAR' ? 'sar' : 'optical';
          setAnalysisMode('optical-sar');
        } else {
          // Before / After pair
          combined[0].slot = 'before';
          combined[1].slot = 'after';
          setAnalysisMode('bi-temporal');
        }
      }
      return combined;
    });

    setSelectedImageIndex(0);
  };

  // Simple 1-click relationship switcher for 2 images
  const handleUpdateRelationship = (relationship: 'before-after' | 'optical-sar' | 'independent') => {
    setImages((prev) => {
      if (prev.length !== 2) return prev;
      const updated = [...prev];
      if (relationship === 'before-after') {
        updated[0].slot = 'before';
        updated[1].slot = 'after';
        setAnalysisMode('bi-temporal');
      } else if (relationship === 'optical-sar') {
        updated[0].slot = 'optical';
        updated[1].slot = 'sar';
        if (updated[1].metadata) updated[1].metadata.modality = 'SAR';
        setAnalysisMode('optical-sar');
      } else {
        updated[0].slot = 'primary';
        updated[1].slot = 'secondary';
        setAnalysisMode('auto');
      }
      return updated;
    });
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      if (selectedImageIndex >= filtered.length) {
        setSelectedImageIndex(Math.max(0, filtered.length - 1));
      }
      return filtered;
    });
  };

  const handleClearAll = () => {
    setImages([]);
    setSelectedImageIndex(0);
  };

  const handleLoadDataset = (dataset: SampleDataset) => {
    const loaded = loadSampleDataset(dataset);
    setImages(loaded);
    setSelectedImageIndex(0);
    if (dataset.recommendedQueries && dataset.recommendedQueries[0]) {
      setInputQuery(dataset.recommendedQueries[0]);
    }
    // Set matching analysis mode
    if (dataset.id === 'bitemporal_expansion') {
      setAnalysisMode('bi-temporal');
    } else if (dataset.id === 'crossmodal_cloud_penetration') {
      setAnalysisMode('optical-sar');
    } else if (dataset.id === 'sar_radar_complex') {
      setAnalysisMode('sar');
    } else {
      setAnalysisMode('auto');
    }
  };

  const handleLoadDatasetById = (datasetId: string, initialQuery?: string) => {
    const dataset = SAMPLE_DATASETS.find((d) => d.id === datasetId);
    if (dataset) {
      handleLoadDataset(dataset);
      if (initialQuery) {
        setInputQuery(initialQuery);
      }
    }
  };

  const handleResetSession = () => {
    setImages([]);
    setInputQuery('');
    setError(null);
    setSelectedImageIndex(0);
    setAnalysisMode('auto');
    setMessages([
      {
        id: Date.now().toString(),
        role: 'model',
        text: 'Session reset. Ready for new satellite imagery.'
      }
    ]);
  };

  const handleSubmitQuery = async () => {
    if (!inputQuery.trim() && images.length === 0) return;
    if (isLoading) return;

    const queryText = inputQuery.trim() || 'Analyze these satellite observations.';
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: queryText,
      images: images.map((img) => img.previewUrl)
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);
    setError(null);

    // Switch to results tab on mobile so user sees analysis result immediately
    setMobileTab('results');

    try {
      const responseData = await sendChatMessage(
        messages,
        newUserMessage,
        images,
        trainingData,
        analysisMode,
        aiMode,
        sessionId
      );

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: '',
          agentResponse: responseData
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'An error occurred during inference. Ensure Gemini API key or local Ollama is active.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = () => {
    const lastResponse = latestModelMessage?.agentResponse;
    if (!lastResponse) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.text || inputQuery || 'Remote Sensing Analysis';
    const reportText = generateSihReport(lastUserMsg, lastResponse, images, sessionId);
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SatQuery_Audit_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const latestModelMessage = [...messages].reverse().find((m) => m.role === 'model' && m.agentResponse);
  const latestResponse = latestModelMessage?.agentResponse;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      
      {/* 1. TOP HEADER NAVIGATION BAR */}
      <WorkstationHeader
        aiMode={aiMode}
        onChangeAiMode={setAiMode}
        systemHealth={systemHealth}
        healthStatus={healthStatus}
        sessionId={sessionId}
        onResetSession={handleResetSession}
        onOpenSpecModal={() => setIsSpecModalOpen(true)}
        onOpenSemanticSearch={() => setIsSemanticModalOpen(true)}
        onOpenDiscovery={() => setIsDiscoveryModalOpen(true)}
        onOpenEvaluation={() => setIsEvaluationModalOpen(true)}
        isBiTemporalAvailable={images.length >= 2}
        activeWorkspaceView={workspaceView}
        onChangeWorkspaceView={setWorkspaceView}
      />

      {/* Global Error Banner */}
      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center justify-between shrink-0 z-40 shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 text-red-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* VIEW 1: DEDICATED ANALYST REVIEW WORKSPACE (Phase 7) */}
      {workspaceView === 'review' ? (
        <AnalystReviewWorkspace
          onOpenTemporalLab={(beforeUrl, afterUrl) => {
            if (beforeUrl && afterUrl) {
              setWorkspaceView('temporal-lab');
            }
          }}
          onOpenDiscovery={(sceneId) => {
            setDiscoveryRefSceneId(sceneId);
            setIsDiscoveryModalOpen(true);
          }}
        />
      ) : (
        <>
          {/* Mobile Tab Switcher (Viewer vs Question & Evidence) */}
          <div className="flex lg:hidden bg-slate-900 border-b border-slate-800 p-1 shrink-0">
            <button
              onClick={() => setMobileTab('viewer')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                mobileTab === 'viewer' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass size={13} />
              <span>{workspaceView === 'temporal-lab' ? 'Temporal Lab' : `Imagery Viewer (${images.length})`}</span>
            </button>
            <button
              onClick={() => setMobileTab('results')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                mobileTab === 'results' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck size={13} />
              <span>Question &amp; Evidence</span>
            </button>
          </div>

          {/* 2. MAIN 2-COLUMN WORKSTATION LAYOUT */}
          <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 p-2 md:p-3 gap-2 md:gap-3 bg-slate-950">
            
            {/* LEFT / CENTER: Upload & Satellite Viewer OR Multi-Temporal Change Lab */}
            <section className={`w-full lg:w-[58%] xl:w-[60%] h-full flex flex-col overflow-hidden ${
              mobileTab !== 'viewer' ? 'hidden lg:flex' : 'flex'
            }`}>
              {workspaceView === 'temporal-lab' && images.length >= 2 ? (
                <MultiTemporalChangeSuite
                  beforeImage={images.find((i) => i.slot === 'before') || images[0]}
                  afterImage={images.find((i) => i.slot === 'after') || images[1] || images[0]}
                  onAskQuestionAboutChange={(query) => {
                    setInputQuery(query);
                    handleSubmitQuery();
                    setWorkspaceView('workstation');
                  }}
                  onExportReport={handleDownloadReport}
                />
              ) : (
                <SatelliteViewer
                  images={images}
                  selectedImageIndex={selectedImageIndex}
                  onSelectImage={setSelectedImageIndex}
                  onUploadFiles={handleUploadFiles}
                  onRemoveImage={handleRemoveImage}
                  onClearAll={handleClearAll}
                  onUpdateRelationship={handleUpdateRelationship}
                  onLoadDataset={handleLoadDataset}
                  onOpenSemanticSearch={() => setIsSemanticModalOpen(true)}
                  onOpenTemporalLab={() => setWorkspaceView('temporal-lab')}
                  groundingBoxes={latestResponse?.groundingBoxes || []}
                  activeTask={latestResponse?.taskClassification}
                  decision={latestResponse?.confidence.level}
                />
              )}
            </section>

            {/* RIGHT: Question Box & Result / Evidence Gate (~42% width) */}
            <section className={`w-full lg:w-[42%] xl:w-[40%] h-full flex flex-col overflow-hidden ${
              mobileTab !== 'results' ? 'hidden lg:flex' : 'flex'
            }`}>
              <UnifiedQuestionResultPanel
                inputQuery={inputQuery}
                onChangeQuery={setInputQuery}
                onSubmitQuery={handleSubmitQuery}
                isLoading={isLoading}
                images={images}
                latestResponse={latestResponse}
                onDownloadReport={handleDownloadReport}
              />
            </section>

          </main>
        </>
      )}

      {/* Semantic Satellite Retrieval Modal (SIH-26227) */}
      <SemanticRetrievalModal
        isOpen={isSemanticModalOpen}
        onClose={() => setIsSemanticModalOpen(false)}
        onLoadDatasetById={handleLoadDatasetById}
        onSelectBiTemporalMode={() => setWorkspaceView('temporal-lab')}
      />

      {/* Similar-Site Discovery & Clustering Modal (Phase 6) */}
      <SimilarSiteDiscoveryModal
        isOpen={isDiscoveryModalOpen}
        onClose={() => setIsDiscoveryModalOpen(false)}
        referenceSceneId={discoveryRefSceneId}
        onOpenTemporalLab={() => setWorkspaceView('temporal-lab')}
        onSendToReviewQueue={() => setWorkspaceView('review')}
      />

      {/* Evaluation & Offline Diagnostics Modal (Phase 8) */}
      <EvaluationDiagnosticsModal
        isOpen={isEvaluationModalOpen}
        onClose={() => setIsEvaluationModalOpen(false)}
      />

      {/* System Specification Modal */}
      <SpecificationModal
        isOpen={isSpecModalOpen}
        onClose={() => setIsSpecModalOpen(false)}
        specification={trainingData}
        setSpecification={setTrainingData}
      />
    </div>
  );
}
